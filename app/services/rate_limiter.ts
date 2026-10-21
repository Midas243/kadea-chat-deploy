/**
 * Limiteur de tentatives en mémoire (fenêtre fixe).
 *
 * Suffisant pour une seule instance du serveur (cas de ce projet). Les compteurs
 * sont remis à zéro quand le serveur redémarre. Si l'application passe un jour
 * sur plusieurs instances, remplacer par @adonisjs/limiter avec un store
 * partagé (base de données ou Redis).
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export default class RateLimiter {
  /**
   * Enregistre une tentative pour `key` et indique si elle est autorisée.
   * `retryAfterMs` = temps restant avant la remise à zéro du compteur.
   */
  static hit(key: string, max: number, windowMs: number) {
    const now = Date.now()
    if (buckets.size > MAX_BUCKETS) this.#prune(now)

    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }
    bucket.count++

    return { allowed: bucket.count <= max, retryAfterMs: bucket.resetAt - now }
  }

  static #prune(now: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }
}
