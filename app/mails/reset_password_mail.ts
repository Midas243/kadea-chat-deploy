import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

export default class ResetPasswordMail extends BaseMail {
  subject = 'Réinitialisation de votre mot de passe – Kadea Chat'
  private user: User
  private url: string

  constructor(user: User, url: string) {
    super()
    this.user = user
    this.url = url
  }

  prepare() {
    this.message.to(this.user.email).htmlView('mails/reset_password', {
      name: this.user.fullName ?? this.user.email,
      url: this.url,
    })
  }
}
