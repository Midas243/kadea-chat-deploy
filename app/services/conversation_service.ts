import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type transmitService from '@adonisjs/transmit/services/main'
import Conversation from '#models/conversation'
import Message from '#models/message'
import User from '#models/user'

export type ConversationItem = {
  id: number
  title: string
  initials: string
  avatarUrl: string | null
  isGroup: boolean
  subtitle: string
  preview: string
  timeLabel: string
  unreadCount: number
}

/** « 14:32 » aujourd'hui, « Hier », sinon « 12/10/2026 ». */
export function formatListDate(date: DateTime): string {
  const now = DateTime.now()
  if (date.hasSame(now, 'day')) return date.toFormat('HH:mm')
  if (date.hasSame(now.minus({ days: 1 }), 'day')) return 'Hier'
  return date.toFormat('dd/MM/yyyy')
}

/** Transforme une conversation (avec members.user préchargés) en données prêtes pour la vue. */
export function describeConversation(
  conversation: Conversation,
  me: User,
  lastMessage?: Message | null,
  unreadCount = 0
): ConversationItem {
  let title: string
  let initials: string
  let avatarUrl: string | null = null
  let subtitle: string

  if (conversation.type === 'group') {
    title = conversation.name ?? 'Groupe'
    initials = title.slice(0, 2).toUpperCase()
    subtitle = `${conversation.members.length} membres`
  } else {
    const other = conversation.members.find((m) => m.userId !== me.id)?.user
    title = other?.fullName ?? other?.email ?? 'Utilisateur'
    initials = other?.initials ?? '?'
    avatarUrl = other?.profilePicture ?? null
    subtitle = other?.email ?? ''
  }

  let preview = 'Nouvelle conversation'
  if (lastMessage) {
    if (lastMessage.deletedAt) preview = 'Ce message a été supprimé'
    else preview = (lastMessage.senderId === me.id ? 'Vous : ' : '') + (lastMessage.content ?? '')
  }

  const date = lastMessage?.createdAt ?? conversation.createdAt

  return {
    id: conversation.id,
    title,
    initials,
    avatarUrl,
    isGroup: conversation.type === 'group',
    subtitle,
    preview,
    timeLabel: formatListDate(date),
    unreadCount,
  }
}

/**
 * Nombre de messages non lus par conversation pour cet utilisateur :
 * messages des autres, non supprimés, postés après la dernière lecture
 * (ou après l'arrivée dans la conversation si elle n'a jamais été ouverte).
 */
async function countUnread(me: User, conversationIds: number[]): Promise<Map<number, number>> {
  if (conversationIds.length === 0) return new Map()
  const rows = await db
    .from('messages')
    .join('members', 'members.conversation_id', 'messages.conversation_id')
    .where('members.user_id', me.id)
    .whereIn('messages.conversation_id', conversationIds)
    .whereNot('messages.sender_id', me.id)
    .whereNull('messages.deleted_at')
    .whereRaw('messages.created_at > COALESCE(members.last_read_at, members.added_at)')
    .groupBy('messages.conversation_id')
    .select('messages.conversation_id as conversation_id')
    .count('* as total')
  return new Map(rows.map((r) => [Number(r.conversation_id), Number(r.total)]))
}

/** Prépare l'affichage d'un ensemble de conversations (dernier message + non lus). */
async function buildItems(
  me: User,
  conversations: Conversation[]
): Promise<{ sortKey: number; item: ConversationItem }[]> {
  const ids = conversations.map((c) => c.id)
  const lastMessages = ids.length
    ? await Message.query().whereIn(
        'id',
        db.from('messages').whereIn('conversation_id', ids).groupBy('conversation_id').max('id')
      )
    : []
  const lastByConversation = new Map(lastMessages.map((m) => [m.conversationId, m]))
  const unread = await countUnread(me, ids)

  return conversations.map((c) => ({
    sortKey: (lastByConversation.get(c.id)?.createdAt ?? c.createdAt).toMillis(),
    item: describeConversation(c, me, lastByConversation.get(c.id), unread.get(c.id) ?? 0),
  }))
}

/** Liste des conversations de l'utilisateur, la plus récente en premier. */
export async function listConversations(me: User): Promise<ConversationItem[]> {
  const conversations = await Conversation.query()
    .whereHas('members', (q) => q.where('user_id', me.id))
    .preload('members', (q) => q.preload('user'))

  return (await buildItems(me, conversations))
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((x) => x.item)
}

/** Une seule conversation prête pour l'affichage (carte mise à jour en direct). */
export async function getConversationItem(
  me: User,
  conversation: Conversation
): Promise<ConversationItem> {
  await conversation.load('members', (q) => q.preload('user'))
  return (await buildItems(me, [conversation]))[0].item
}

/** Marque une conversation comme lue maintenant. */
export async function markConversationRead(me: User, conversationId: number) {
  await db
    .from('members')
    .where('conversation_id', conversationId)
    .where('user_id', me.id)
    .update({ last_read_at: DateTime.now().toSQL() })
}

/** Prévient chaque membre (canal personnel) qu'une conversation a changé. */
export async function notifyMembers(
  transmit: typeof transmitService,
  conversationId: number
) {
  const rows = await db.from('members').where('conversation_id', conversationId).select('user_id')
  for (const row of rows) {
    transmit.broadcast(`users/${row.user_id}`, { type: 'conversation.updated', conversationId })
  }
}

/** Recherche d'utilisateurs (nom ou e-mail) pour démarrer une conversation. */
export async function searchUsers(me: User, term: string, excludeIds: number[] = []) {
  const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`
  return User.query()
    .whereNot('id', me.id)
    .whereNotNull('email_verified_at')
    .if(excludeIds.length > 0, (q) => q.whereNotIn('id', excludeIds))
    .where((q) => q.whereILike('full_name', like).orWhereILike('email', like))
    .orderBy('full_name', 'asc')
    .limit(10)
}

/** Retrouve la conversation privée entre deux personnes, ou la crée. */
export async function findOrCreatePrivate(me: User, otherId: number): Promise<Conversation> {
  const existing = await Conversation.query()
    .where('type', 'private')
    .whereHas('members', (q) => q.where('user_id', me.id))
    .whereHas('members', (q) => q.where('user_id', otherId))
    .first()
  if (existing) return existing

  return db.transaction(async (trx) => {
    const conversation = await Conversation.create(
      { type: 'private', creatorId: me.id },
      { client: trx }
    )
    const now = new Date()
    await trx.table('members').insert([
      { conversation_id: conversation.id, user_id: me.id, role: 'member', added_at: now },
      { conversation_id: conversation.id, user_id: otherId, role: 'member', added_at: now },
    ])
    return conversation
  })
}
