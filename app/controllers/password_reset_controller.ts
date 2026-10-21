import { DateTime } from 'luxon'
import User from '#models/user'
import AuthNotifier from '#services/auth_notifier'
import TokenService from '#services/token_service'
import { emailValidator, resetPasswordValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class PasswordResetController {
  /** Formulaire « mot de passe oublié » */
  async forgot({ view }: HttpContext) {
    return view.render('pages/auth/forgot_password')
  }

  /** Envoi du lien de réinitialisation */
  async send({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(emailValidator)
    const user = await User.findBy('email', email)

    if (user) {
      await AuthNotifier.sendPasswordReset(user)
    }

    session.flash(
      'success',
      "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé."
    )
    return response.redirect().toRoute('session.create')
  }

  /** Page du nouveau mot de passe (depuis le lien reçu) */
  async edit({ params, view, response, session }: HttpContext) {
    const token = await TokenService.findValid(params.token, 'password_reset')
    if (!token) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Refaites une demande.')
      return response.redirect().toRoute('password.forgot')
    }
    return view.render('pages/auth/reset_password', { token: params.token })
  }

  /** Enregistrement du nouveau mot de passe */
  async update({ params, request, response, session }: HttpContext) {
    const { password } = await request.validateUsing(resetPasswordValidator)

    const token = await TokenService.findValid(params.token, 'password_reset')
    if (!token) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Refaites une demande.')
      return response.redirect().toRoute('password.forgot')
    }

    const user = token.user
    user.password = password // haché automatiquement à l'enregistrement
    // Avoir reçu le lien prouve que l'adresse est la bonne
    user.emailVerifiedAt = user.emailVerifiedAt ?? DateTime.now()
    await user.save()
    await TokenService.consume(token)

    session.flash('success', 'Mot de passe modifié. Connectez-vous avec le nouveau.')
    return response.redirect().toRoute('session.create')
  }
}
