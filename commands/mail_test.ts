import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'

/**
 * Envoie un e-mail de test directement via l'API Brevo
 * et affiche la réponse exacte en cas d'erreur.
 *
 *   node ace mail:test vous@exemple.com
 */
export default class MailTest extends BaseCommand {
  static commandName = 'mail:test'
  static description = "Envoie un e-mail de test pour vérifier la configuration d'envoi"
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Adresse du destinataire' })
  declare to: string

  async run() {
    const key = env.get('BREVO_API_KEY')
    this.logger.info(`Expéditeur : ${env.get('MAIL_FROM_ADDRESS')}`)
    this.logger.info(`Destinataire : ${this.to}`)
    this.logger.info(`Clé API : ${key.slice(0, 8)}… (${key.length} caractères)`)

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': key,
          'content-type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: env.get('MAIL_FROM_NAME'), email: env.get('MAIL_FROM_ADDRESS') },
          to: [{ email: this.to }],
          subject: 'Test d’envoi – Kadea Chat',
          htmlContent: '<p>Si vous lisez ce message, l’envoi d’e-mails fonctionne.</p>',
        }),
      })
      const body = await res.text()

      if (res.ok) {
        this.logger.success(`Accepté par Brevo (${res.status}). Vérifiez la boîte et les spams.`)
      } else {
        this.logger.error(`Brevo a répondu ${res.status} :`)
        this.logger.error(body)
        this.exitCode = 1
      }
    } catch (error) {
      this.logger.error('Impossible de joindre Brevo (réseau, pare-feu, antivirus ?) :')
      this.logger.error(String(error?.cause?.message ?? error?.message ?? error))
      this.exitCode = 1
    }
  }
}
