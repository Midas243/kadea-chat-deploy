import transmit from '@adonisjs/transmit/services/main'
import Conversation from '#models/conversation'
import { addMembersValidator, createGroupValidator } from '#validators/group'
import { describeConversation, listConversations, notifyMembers } from '#services/conversation_service'
import { addMembers, createGroup, removeMember } from '#services/group_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class GroupsController {
  /** Formulaire de création d'un groupe. */
  async create({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    return view.render('pages/groups/create', {
      conversations: await listConversations(user),
      activeId: null,
    })
  }

  /** Création : le créateur devient administrateur. */
  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { name, memberIds } = await request.validateUsing(createGroupValidator)

    const group = await createGroup(user, name, memberIds)
    if (!group) {
      session.flash('error', "Aucun des utilisateurs choisis n'est disponible.")
      return response.redirect().back()
    }
    // le groupe apparaît tout de suite dans la liste des membres
    await notifyMembers(transmit, group.id)
    return response.redirect().toRoute('conversations.show', { id: group.id })
  }

  /** Infos du groupe : liste des membres (tous) et gestion (administrateurs). */
  async show({ auth, params, bouncer, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const group = await Conversation.findOrFail(params.id)
    if (group.type !== 'group') return response.notFound('Groupe introuvable')

    await bouncer.with('ConversationPolicy').authorize('view', group)
    await group.load('members', (q) => q.preload('user'))

    const members = [...group.members].sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
      return (a.user.fullName ?? a.user.email).localeCompare(b.user.fullName ?? b.user.email)
    })

    return view.render('pages/groups/show', {
      conversations: await listConversations(user),
      activeId: group.id,
      group: describeConversation(group, user),
      members,
      canManage: await bouncer.with('ConversationPolicy').allows('manageMembers', group),
    })
  }

  /** Ajout de membres : administrateurs uniquement. */
  async addMembers({ params, request, response, bouncer, session }: HttpContext) {
    const group = await Conversation.findOrFail(params.id)
    await bouncer.with('ConversationPolicy').authorize('manageMembers', group)

    const { memberIds } = await request.validateUsing(addMembersValidator)
    const added = await addMembers(group, memberIds)
    if (added > 0) await notifyMembers(transmit, group.id)

    session.flash(
      added > 0 ? 'success' : 'error',
      added > 0 ? `${added} membre(s) ajouté(s).` : 'Ces personnes sont déjà dans le groupe.'
    )
    return response.redirect().toRoute('groups.show', { id: group.id })
  }

  /** Retrait d'un membre : administrateurs uniquement, et jamais soi-même. */
  async removeMember({ auth, params, response, bouncer, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const group = await Conversation.findOrFail(params.id)
    await bouncer.with('ConversationPolicy').authorize('manageMembers', group)

    if (Number(params.userId) === user.id) {
      session.flash('error', 'Vous ne pouvez pas vous retirer vous-même du groupe.')
    } else {
      try {
        const removed = await removeMember(group, Number(params.userId))
        if (removed) {
          // la personne retirée perd la conversation à l'écran, les autres voient le changement
          transmit.broadcast(`users/${Number(params.userId)}`, {
            type: 'conversation.removed',
            conversationId: group.id,
          })
          await notifyMembers(transmit, group.id)
        }
        session.flash('success', 'Membre retiré du groupe.')
      } catch (error) {
        session.flash('error', error instanceof Error ? error.message : 'Retrait impossible.')
      }
    }
    return response.redirect().toRoute('groups.show', { id: group.id })
  }
}
