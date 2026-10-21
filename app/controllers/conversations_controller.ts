import Conversation from '#models/conversation'
import Message from '#models/message'
import User from '#models/user'
import { startConversationValidator } from '#validators/conversation'
import {
  describeConversation,
  findOrCreatePrivate,
  getConversationItem,
  listConversations,
  markConversationRead,
  searchUsers,
} from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class ConversationsController {
  /** Liste des conversations + recherche d'utilisateurs. */
  async index({ auth, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const q = String(request.input('q', '')).trim()
    const conversations = await listConversations(user)
    const results = q.length >= 2 ? await searchUsers(user, q) : []

    return view.render('pages/conversations/index', { conversations, q, results, activeId: null })
  }

  /** Une conversation ouverte : historique + liste à gauche. */
  async show({ auth, params, bouncer, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await Conversation.findOrFail(params.id)
    await bouncer.with('ConversationPolicy').authorize('view', conversation)

    await conversation.load('members', (q) => q.preload('user'))

    // les 100 derniers messages, affichés du plus ancien au plus récent
    const latest = await Message.query()
      .where('conversation_id', conversation.id)
      .preload('sender')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(100)
    const messages = latest.reverse()

    await markConversationRead(user, conversation.id)

    return view.render('pages/conversations/show', {
      conversations: await listConversations(user),
      activeId: conversation.id,
      current: describeConversation(conversation, user),
      messages,
      q: '',
      results: [],
    })
  }

  /** Carte HTML d'une conversation : appelée quand le canal personnel annonce un changement. */
  async card({ auth, params, request, bouncer, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await Conversation.findOrFail(params.id)
    await bouncer.with('ConversationPolicy').authorize('view', conversation)

    return view.render('partials/conversation_card_fragment', {
      item: await getConversationItem(user, conversation),
      active: request.input('active') === '1',
    })
  }

  /** Marque la conversation comme lue (appelée quand un message arrive dans la conversation ouverte). */
  async read({ auth, params, response, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await Conversation.findOrFail(params.id)
    await bouncer.with('ConversationPolicy').authorize('view', conversation)

    await markConversationRead(user, conversation.id)
    return response.noContent()
  }

  /** Démarre (ou retrouve) une conversation privée avec un utilisateur. */
  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { userId } = await request.validateUsing(startConversationValidator)

    const other = await User.find(userId)
    if (!other || !other.emailVerifiedAt || other.id === user.id) {
      session.flash('error', "Cet utilisateur n'est pas disponible.")
      return response.redirect().back()
    }

    const conversation = await findOrCreatePrivate(user, other.id)
    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }
}
