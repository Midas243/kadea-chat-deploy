import { DateTime } from 'luxon'
import User from '#models/user'
import AuthNotifier from '#services/auth_notifier'
import TokenService from '#services/token_service'
import { emailValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class EmailVerificationController {
  /** Page « vérifiez votre boîte mail » + formulaire de renvoi */
  async notice({ view }: HttpContext) {
    return view.render('pages/auth/verify_notice')
  }

  /** Clic sur le lien reçu par e-mail */
  async verify({ params, response, session }: HttpContext) {
    const token = await TokenService.findValid(params.token, 'email_confirmation')

    if (!token) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.')
      return response.redirect().toRoute('verification.notice')
    }

    const user = token.user
    user.emailVerifiedAt = DateTime.now()
    await user.save()
    await TokenService.consume(token)

    session.flash('success', 'Adresse confirmée ! Vous pouvez vous connecter.')
    return response.redirect().toRoute('session.create')
  }

  /** Renvoyer l'e-mail de confirmation */
  async resend({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(emailValidator)
    const user = await User.findBy('email', email)

    if (user && !user.emailVerifiedAt) {
      await AuthNotifier.sendVerification(user)
    }

    // Même message dans tous les cas : on ne révèle pas si l'adresse existe
    session.flash(
      'success',
      "Si un compte non confirmé existe pour cette adresse, un nouvel e-mail vient d'être envoyé."
    )
    session.flash('email', email)
    return response.redirect().toRoute('verification.notice')
  }
}
