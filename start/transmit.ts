import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import Conversation from '#models/conversation'

/**
 * Canal d'une conversation : « conversations/12 ».
 * Un utilisateur ne peut s'y abonner que s'il est membre de la conversation
 * (même règle que pour afficher la page : ConversationPolicy.view).
 */
transmit.authorize<{ id: string }>('conversations/:id', async (ctx: HttpContext, { id }) => {
  if (!ctx.auth.user) return false

  const conversationId = Number(id)
  if (!Number.isInteger(conversationId)) return false

  const conversation = await Conversation.find(conversationId)
  if (!conversation) return false

  return ctx.bouncer.with('ConversationPolicy').allows('view', conversation)
})

/**
 * Canal personnel : « users/12 ». Chacun ne peut écouter que le sien.
 * Il sert à remonter une conversation et à mettre à jour le badge « non lus ».
 */
transmit.authorize<{ id: string }>('users/:id', (ctx: HttpContext, { id }) => {
  return ctx.auth.user !== undefined && ctx.auth.user.id === Number(id)
})
