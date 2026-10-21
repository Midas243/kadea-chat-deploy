import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import { searchUsers } from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class UserSearchController {
  /**
   * Recherche d'utilisateurs en JSON (pour choisir les membres d'un groupe).
   * Avec ?conversationId=, les personnes déjà membres sont exclues.
   */
  async index({ auth, request, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const term = String(request.input('q', '')).trim()
    if (term.length < 2) return []

    let exclude: number[] = []
    const conversationId = Number(request.input('conversationId'))
    if (Number.isInteger(conversationId) && conversationId > 0) {
      const conversation = await Conversation.find(conversationId)
      if (conversation) {
        await bouncer.with('ConversationPolicy').authorize('view', conversation)
        const rows = await db.from('members').where('conversation_id', conversation.id).select('user_id')
        exclude = rows.map((row) => Number(row.user_id))
      }
    }

    const users = await searchUsers(user, term, exclude)
    return users.map((u) => ({
      id: u.id,
      name: u.fullName ?? u.email,
      email: u.email,
      initials: u.initials,
    }))
  }
}
