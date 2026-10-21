import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import User from '#models/user'

/** Ne garde que les comptes qui existent et ont confirmé leur e-mail. */
async function validUserIds(ids: number[]): Promise<number[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const users = await User.query().whereIn('id', unique).whereNotNull('email_verified_at')
  return users.map((u) => u.id)
}

/** Crée un groupe : le créateur en est l'administrateur, les autres sont membres. */
export async function createGroup(
  creator: User,
  name: string,
  memberIds: number[]
): Promise<Conversation | null> {
  const others = (await validUserIds(memberIds)).filter((id) => id !== creator.id)
  if (others.length === 0) return null

  return db.transaction(async (trx) => {
    const group = await Conversation.create(
      { type: 'group', name, creatorId: creator.id },
      { client: trx }
    )
    const now = new Date()
    await trx.table('members').insert([
      { conversation_id: group.id, user_id: creator.id, role: 'admin', added_at: now },
      ...others.map((id) => ({
        conversation_id: group.id,
        user_id: id,
        role: 'member',
        added_at: now,
      })),
    ])
    return group
  })
}

/** Ajoute des membres (en ignorant ceux qui sont déjà dans le groupe). Renvoie le nombre ajouté. */
export async function addMembers(group: Conversation, memberIds: number[]): Promise<number> {
  const valid = await validUserIds(memberIds)
  const existing = await db.from('members').where('conversation_id', group.id).select('user_id')
  const already = new Set(existing.map((row) => Number(row.user_id)))
  const toAdd = valid.filter((id) => !already.has(id))
  if (toAdd.length === 0) return 0

  const now = new Date()
  await db.table('members').insert(
    toAdd.map((id) => ({
      conversation_id: group.id,
      user_id: id,
      role: 'member',
      added_at: now,
    }))
  )
  return toAdd.length
}

/** Retire un membre sans supprimer le dernier administrateur. */
export async function removeMember(
  group: Conversation,
  userId: number
): Promise<boolean> {
  return db.transaction(async (trx) => {
    const target = await trx
      .from('members')
      .where('conversation_id', group.id)
      .where('user_id', userId)
      .first()

    if (!target) {
      return false
    }

    if (target.role === 'admin') {
      const admins = await trx
        .from('members')
        .where('conversation_id', group.id)
        .where('role', 'admin')
        .count('* as total')

      if (Number(admins[0].total) <= 1) {
        throw new Error(
          'Impossible de retirer le dernier administrateur du groupe.'
        )
      }
    }

    await trx
      .from('members')
      .where('conversation_id', group.id)
      .where('user_id', userId)
      .delete()

    return true
  })
}
