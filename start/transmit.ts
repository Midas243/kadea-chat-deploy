import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import Conversation from '#models/conversation'

/**
 * Autorisations des canaux temps réel.
 *
 * Elles sont vérifiées UNE FOIS, au moment de l'abonnement (POST /__transmit/subscribe).
 * Un callback qui renvoie false → Transmit répond 400 et l'abonnement n'est pas créé.
 */

/** « 12 » → 12, tout le reste (« abc », « 1.5 », « -3 ») → null. */
function toId(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null
}

/**
 * Canal d'une conversation : « conversations/12 ».
 * Réservé aux membres : même règle que pour afficher la page (ConversationPolicy.view).
 */
transmit.authorize<{ id: string }>('conversations/:id', async (ctx: HttpContext, { id }) => {
  if (!ctx.auth.user) return false

  const conversationId = toId(id)
  if (conversationId === null) return false

  const conversation = await Conversation.find(conversationId)
  if (!conversation) return false

  return ctx.bouncer.with('ConversationPolicy').allows('view', conversation)
})

/**
 * Canal personnel : « users/12 ».
 * Chacun n'écoute que le sien : il sert à remonter une conversation, mettre à jour
 * le badge « non lus » et signaler un retrait de groupe.
 */
transmit.authorize<{ id: string }>('users/:id', (ctx: HttpContext, { id }) => {
  const userId = toId(id)
  return userId !== null && ctx.auth.user?.id === userId
})
