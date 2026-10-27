import AuthNotifier from '#services/auth_notifier'
import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  async store({ request, response, session }: HttpContext) {
    const { fullName, email, password } = await request.validateUsing(signupValidator)

    // Le compte est créé non confirmé : la connexion reste bloquée jusqu'au clic sur le lien
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
