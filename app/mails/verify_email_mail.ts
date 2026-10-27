import { BaseMail } from '@adonisjs/mail'
import type User from '#models/user'

export default class VerifyEmailMail extends BaseMail {
  subject = 'Confirmez votre adresse e-mail – Kadea Chat'
  private user: User
  private url: string

  constructor(user: User, url: string) {
    super()
    this.user = user
    this.url = url
  }

  prepare() {
    // La vue est dans resources/views/mails/ (et non « emails/ »)
    this.message.to(this.user.email).htmlView('mails/verify_email', {
      name: this.user.fullName ?? this.user.email,
      url: this.url,
    })
  }
}
