import { BasePolicy } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import Member from '#models/member'

/** Renvoie la ligne « membre » de cet utilisateur dans la conversation, ou null. */
function findMembership(userId: number, conversationId: number) {
  return Member.query()
    .where('conversation_id', conversationId)
    .where('user_id', userId)
    .first()
}

export default class ConversationPolicy extends BasePolicy {
  /** Lire l'historique et recevoir les messages : il faut être membre. */
  async view(user: User, conversation: Conversation) {
    return (await findMembership(user.id, conversation.id)) !== null
  }

  /** Envoyer un message : mêmes droits que la lecture. */
  async send(user: User, conversation: Conversation) {
    return (await findMembership(user.id, conversation.id)) !== null
  }

  /** Ajouter ou retirer des membres : admin d'un groupe uniquement. */
  async manageMembers(user: User, conversation: Conversation) {
    if (conversation.type !== 'group') return false
    const membership = await findMembership(user.id, conversation.id)
    return membership?.role === 'admin'
  }

  /** Supprimer un message : seulement le sien (et seulement s'il n'est pas déjà supprimé). */
  async deleteMessage(user: User, message: Message) {
    return message.senderId === user.id && message.deletedAt === null
  }
}
