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
    this.message
      .to(this.user.email)
      .htmlView('emails/verify_email', { name: this.user.fullName, url: this.url })
  }
}
