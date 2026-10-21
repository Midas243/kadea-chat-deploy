import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import RateLimiter from '#services/rate_limiter'

export type ThrottleOptions = {
  /** Nom de la règle (ex. « login ») : sépare les compteurs entre les routes. */
  name: string
  /** Nombre maximum de tentatives autorisées dans la fenêtre. */
  max: number
  /** Durée de la fenêtre, en minutes. */
  minutes: number
  /**
   * Si vrai, le compteur est propre à chaque couple (IP, e-mail saisi) : on freine
   * le brute-force d'un compte précis. Un second compteur par IP, 10 fois plus large,
   * freine aussi le balayage de nombreuses adresses depuis une même machine.
   */
  perEmail?: boolean
}

/**
 * Limite les tentatives sur les routes sensibles (connexion, inscription,
 * mot de passe oublié, renvoi de l'e-mail de confirmation).
 */
export default class ThrottleMiddleware {
  async handle(
    { request, response, session }: HttpContext,
    next: NextFn,
    options: ThrottleOptions
  ) {
    const windowMs = options.minutes * 60_000
    const ip = request.ip()

    const results = []
    if (options.perEmail) {
      const email = String(request.input('email', '')).trim().toLowerCase().slice(0, 254)
      results.push(RateLimiter.hit(`${options.name}:${ip}:${email}`, options.max, windowMs))
      results.push(RateLimiter.hit(`${options.name}:${ip}`, options.max * 10, windowMs))
    } else {
      results.push(RateLimiter.hit(`${options.name}:${ip}`, options.max, windowMs))
    }

    const blocked = results.filter((result) => !result.allowed)
    if (blocked.length === 0) {
      return next()
    }

    const retryAfterMs = Math.max(...blocked.map((result) => result.retryAfterMs))
    const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000))
    session.flash(
      'error',
      `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
    )
    session.flashOnly(['email'])
    return response.redirect().back()
  }
}
