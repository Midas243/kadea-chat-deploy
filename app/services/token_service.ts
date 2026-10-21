import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import type User from '#models/user'
import UserToken from '#models/user_token'

export type TokenType = 'email_confirmation' | 'password_reset'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export default class TokenService {
  /**
   * Crée un jeton et renvoie sa valeur EN CLAIR (à mettre dans le lien).
   * Seul le hash est stocké en base. Les anciens jetons du même type sont supprimés.
   */
  static async generate(user: User, type: TokenType, ttlMinutes: number) {
    await UserToken.query().where('user_id', user.id).where('type', type).delete()

    const raw = randomBytes(32).toString('hex')
    await UserToken.create({
      userId: user.id,
      type,
      hash: sha256(raw),
      expiresAt: DateTime.now().plus({ minutes: ttlMinutes }),
    })
    return raw
  }

  /** Retourne le jeton s'il existe, n'est pas utilisé et n'a pas expiré. */
  static async findValid(raw: string, type: TokenType) {
    return UserToken.query()
      .where('hash', sha256(raw))
      .where('type', type)
      .whereNull('used_at')
      .where('expires_at', '>', new Date())
      .preload('user')
      .first()
  }

  /** Marque le jeton comme utilisé (usage unique). */
  static async consume(token: UserToken) {
    token.usedAt = DateTime.now()
    await token.save()
  }
}
