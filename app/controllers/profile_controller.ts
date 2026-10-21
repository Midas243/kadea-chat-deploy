import { randomUUID } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import { listConversations } from '#services/conversation_service'
import { updatePasswordValidator, updateProfileValidator } from '#validators/profile'
import type { HttpContext } from '@adonisjs/core/http'

const AVATAR_DIR = 'public/uploads/avatars'
const AVATAR_URL = '/uploads/avatars'

export default class ProfileController {
  /** Page « Mon profil » (dans la mise en page de la messagerie). */
  async edit({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    return view.render('pages/profile/edit', {
      conversations: await listConversations(user),
      activeId: null,
    })
  }

  /** Nom + photo de profil. */
  async update({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { fullName, profilePicture } = await request.validateUsing(updateProfileValidator)

    user.fullName = fullName

    if (profilePicture) {
      const fileName = `${user.id}-${randomUUID()}.${profilePicture.extname}`
      await profilePicture.move(app.makePath(AVATAR_DIR), { name: fileName })

      // Supprime l'ancienne photo (uniquement si elle est dans notre dossier)
      if (user.profilePicture?.startsWith(`${AVATAR_URL}/`)) {
        const oldName = user.profilePicture.slice(AVATAR_URL.length + 1)
        await unlink(app.makePath(AVATAR_DIR, oldName)).catch(() => {})
      }
      user.profilePicture = `${AVATAR_URL}/${fileName}`
    }

    await user.save()
    session.flash('success', 'Profil mis à jour.')
    return response.redirect().toRoute('profile.edit')
  }

  /** Changement de mot de passe (l'ancien est vérifié). */
  async updatePassword({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { currentPassword, password } = await request.validateUsing(updatePasswordValidator)

    if (!(await hash.verify(user.password, currentPassword))) {
      // Même format que les erreurs VineJS : affiché par @field.error()
      session.flash('inputErrorsBag', {
        currentPassword: ['Le mot de passe actuel est incorrect.'],
      })
      return response.redirect().toRoute('profile.edit')
    }

    user.password = password // haché automatiquement à l'enregistrement
    await user.save()

    session.flash('success', 'Mot de passe modifié.')
    return response.redirect().toRoute('profile.edit')
  }
}
