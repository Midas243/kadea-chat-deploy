import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'

/**
 * Envoie un e-mail de test pour vérifier la configuration Brevo
 * (clé API, expéditeur validé) sans passer par l'inscription.
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
    this.logger.info(`Expéditeur : ${env.get('MAIL_FROM_ADDRESS')}`)
    this.logger.info(`Destinataire : ${this.to}`)

    try {
      await mail.send((message) => {
        message
          .to(this.to)
          .subject('Test d’envoi – Kadea Chat')
          .html('<p>Si vous lisez ce message, l’envoi d’e-mails fonctionne.</p>')
      })
      this.logger.success('E-mail accepté par Brevo. Vérifiez la boîte de réception et les spams.')
    } catch (error) {
      this.logger.error('Échec de l’envoi :')
      this.logger.error(String(error?.message ?? error))
      this.exitCode = 1
    }
  }
}
