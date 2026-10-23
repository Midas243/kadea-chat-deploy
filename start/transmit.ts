import transmit from '@adonisjs/transmit/services/main'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import Conversation from '#models/conversation'

/**
 * Transmit transforme toute exception d'une règle d'autorisation en simple « refusé » (400),
 * sans rien afficher. On journalise donc la raison du refus dans le terminal.
 */
function deny(channel: string, reason: string, error?: unknown) {
  logger.warn({ channel, reason, err: error }, '[transmit] abonnement refusé')
  return false
}

/**
 * Canal d'une conversation : « conversations/12 ».
 * Un utilisateur ne peut s'y abonner que s'il est membre de la conversation
 * (même règle que pour afficher la page : ConversationPolicy.view).
 */
transmit.authorize<{ id: string }>('conversations/:id', async (ctx: HttpContext, { id }) => {
  const channel = `conversations/${id}`
  try {
    if (!ctx.auth.user) return deny(channel, 'utilisateur non connecté')

    const conversationId = Number(id)
    if (!Number.isInteger(conversationId)) return deny(channel, 'identifiant invalide')

    const conversation = await Conversation.find(conversationId)
    if (!conversation) return deny(channel, 'conversation introuvable')

    const allowed = await ctx.bouncer.with('ConversationPolicy').allows('view', conversation)
    return allowed || deny(channel, `l'utilisateur ${ctx.auth.user.id} n'est pas membre`)
  } catch (error) {
    return deny(channel, 'exception dans la règle d\'autorisation', error)
  }
})

/**
 * Canal personnel : « users/12 ». Chacun ne peut écouter que le sien.
 * Il sert à remonter une conversation et à mettre à jour le badge « non lus ».
 */
transmit.authorize<{ id: string }>('users/:id', (ctx: HttpContext, { id }) => {
  const channel = `users/${id}`
  try {
    if (ctx.auth.user === undefined) return deny(channel, 'utilisateur non connecté')
    return ctx.auth.user.id === Number(id) || deny(channel, 'ce canal appartient à un autre utilisateur')
  } catch (error) {
    return deny(channel, 'exception dans la règle d\'autorisation', error)
  }
})
