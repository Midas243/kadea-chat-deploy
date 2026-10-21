import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import type User from '#models/user'
import TokenService from '#services/token_service'
import VerifyEmailMail from '#mails/verify_email_mail'
import ResetPasswordMail from '#mails/reset_password_mail'

/** Durée de validité des liens, en minutes (doit correspondre au texte des e-mails). */
const VERIFY_EMAIL_TTL = 60 * 24 // 24 heures
const RESET_PASSWORD_TTL = 60 // 1 heure

/** APP_URL sans slash final, pour éviter les liens du type https://site.com//verify-email/... */
const baseUrl = () => env.get('APP_URL').replace(/\/+$/, '')

export default class AuthNotifier {
  static async sendVerification(user: User) {
    const token = await TokenService.generate(user, 'email_confirmation', VERIFY_EMAIL_TTL)
    const url = `${baseUrl()}/verify-email/${token}`
    return this.#deliver(new VerifyEmailMail(user, url), user.email, url)
  }

  static async sendPasswordReset(user: User) {
    const token = await TokenService.generate(user, 'password_reset', RESET_PASSWORD_TTL)
    const url = `${baseUrl()}/reset-password/${token}`
    return this.#deliver(new ResetPasswordMail(user, url), user.email, url)
  }

  static async #deliver(message: VerifyEmailMail | ResetPasswordMail, to: string, url: string) {
    // Pratique en développement : le lien apparaît dans le terminal
    if (env.get('NODE_ENV') === 'development') {
      logger.info(`[DEV] Lien pour ${to} : ${url}`)
    }
    try {
      await mail.send(message)
      return true
    } catch (error) {
      logger.error({ err: error }, `Échec d'envoi d'e-mail à ${to}`)
      return false
    }
  }
}
