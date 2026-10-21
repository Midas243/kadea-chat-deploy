import { errors } from '@adonisjs/auth'
import { DateTime } from 'luxon'
import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async create({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  async store({ request, auth, response, session }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    } catch (error) {
      if (error instanceof errors.E_INVALID_CREDENTIALS) {
        session.flash('error', 'Adresse e-mail ou mot de passe incorrect.')
        session.flashOnly(['email'])
        return response.redirect().back()
      }
      throw error
    }

    // Identifiants corrects, mais e-mail pas encore confirmé
    if (!user.emailVerifiedAt) {
      session.flash('error', 'Confirmez votre adresse e-mail avant de vous connecter.')
      session.flash('email', user.email)
      return response.redirect().toRoute('verification.notice')
    }

    user.lastLoginAt = DateTime.now()
    await user.save()

    await auth.use('web').login(user)
    return response.redirect().toRoute('dashboard')
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect().toRoute('session.create')
  }
}
