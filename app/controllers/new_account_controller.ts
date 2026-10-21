import { DateTime } from 'luxon'
import env from '#start/env'
import User from '#models/user'
import AuthNotifier from '#services/auth_notifier'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  async store({ request, response, session, auth }: HttpContext) {
    const { fullName, email, password } = await request.validateUsing(signupValidator)

    // Confirmation désactivée (développement local) : compte validé et connexion directe
    if (!env.get('REQUIRE_EMAIL_VERIFICATION', true)) {
      const verifiedUser = await User.create({
        fullName,
        email,
        password,
        emailVerifiedAt: DateTime.now(),
      })
      await auth.use('web').login(verifiedUser)
      return response.redirect().toRoute('conversations.index')
    }

    const user = await User.create({ fullName, email, password })

    const sent = await AuthNotifier.sendVerification(user)
    if (!sent) {
      session.flash(
        'error',
        "Compte créé, mais l'e-mail n'a pas pu être envoyé. Utilisez « Renvoyer l'e-mail »."
      )
    }
    session.flash('email', user.email)
    return response.redirect().toRoute('verification.notice')
  }
}
