import { DateTime } from 'luxon'
import transmit from '@adonisjs/transmit/services/main'
import Conversation from '#models/conversation'
import Message from '#models/message'
import { messageValidator } from '#validators/conversation'
import { notifyMembers } from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class MessagesController {
  /**
   * Un seul message, rendu en HTML (pour la personne connectée).
   * Le navigateur l'appelle quand le canal annonce un nouveau message.
   */
  async show({ auth, params, bouncer, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const message = await Message.query().where('id', params.id).preload('sender').firstOrFail()
    const conversation = await Conversation.findOrFail(message.conversationId)
    await bouncer.with('ConversationPolicy').authorize('view', conversation)

    return view.render('partials/message_fragment', {
      message,
      mine: message.senderId === user.id,
    })
  }

  /** Envoi d'un message : enregistré, puis annoncé sur le canal de la conversation. */
  async store({ auth, params, request, response, bouncer }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await Conversation.findOrFail(params.conversationId)
    await bouncer.with('ConversationPolicy').authorize('send', conversation)

    const { content } = await request.validateUsing(messageValidator)
    const message = await Message.create({
      conversationId: conversation.id,
      senderId: user.id,
      content,
    })

    transmit.broadcast(`conversations/${conversation.id}`, {
      type: 'message.created',
      messageId: message.id,
    })
    await notifyMembers(transmit, conversation.id)

    if (request.accepts(['html', 'json']) === 'json') {
      return response.created({ id: message.id })
    }
    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }

  /** Suppression « douce » : la ligne reste, le texte est effacé. */
  async destroy({ params, request, response, bouncer }: HttpContext) {
    const message = await Message.findOrFail(params.id)
    const conversation = await Conversation.findOrFail(message.conversationId)

    await bouncer.with('ConversationPolicy').authorize('view', conversation)
    await bouncer.with('ConversationPolicy').authorize('deleteMessage', message)

    message.deletedAt = DateTime.now()
    message.content = null
    await message.save()

    transmit.broadcast(`conversations/${conversation.id}`, {
      type: 'message.deleted',
      messageId: message.id,
    })
    await notifyMembers(transmit, conversation.id)

    if (request.accepts(['html', 'json']) === 'json') {
      return response.noContent()
    }
    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }
}
