import { Transmit } from '@adonisjs/transmit-client'

/**
 * Couche temps réel : une seule connexion SSE par page, partagée par tous les composants.
 *
 * Point important de @adonisjs/transmit-client : subscription.create() NE LÈVE JAMAIS
 * d'erreur. Si l'abonnement est refusé (403, 400…) ou si le réseau échoue, la promesse
 * se résout quand même et rien n'est reçu. On vérifie donc nous-mêmes `isCreated`.
 */

let client = null
let status = 'connecting' // connecting | connected | reconnecting | failed
let previous = 'connecting'
let lastFailure = 0 // dernier code HTTP d'un abonnement refusé
const statusListeners = new Set()

function setStatus(next) {
  if (next === status) return
  previous = status
  status = next
  statusListeners.forEach((fn) => fn(status, previous))
}

export function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content ?? ''
}

/** En-têtes pour les appels fetch « ajax » (CSRF + indication que la page ne se recharge pas). */
export function ajaxHeaders(extra = {}) {
  return { 'X-CSRF-TOKEN': csrfToken(), 'X-Requested-With': 'XMLHttpRequest', ...extra }
}

function getClient() {
  if (client) return client

  const addToken = (request) => request.headers.set('X-CSRF-TOKEN', csrfToken())

  client = new Transmit({
    baseUrl: window.location.origin,
    // 5 par défaut : trop peu pour un chat. Au-delà de 30 essais on affiche « rechargez ».
    maxReconnectAttempts: 30,
    beforeSubscribe: addToken,
    beforeUnsubscribe: addToken,
    onReconnectAttempt: () => setStatus('reconnecting'),
    onReconnectFailed: () => setStatus('failed'),
    onSubscribeFailed: (response) => {
      lastFailure = response.status
    },
  })

  client.on('connected', () => setStatus('connected'))
  client.on('disconnected', () => setStatus('reconnecting'))
  client.on('reconnecting', () => setStatus('reconnecting'))

  return client
}

/**
 * Suit l'état de la connexion. Le callback reçoit (état, état précédent)
 * et est appelé tout de suite avec l'état courant. Renvoie une fonction pour arrêter.
 */
export function onStatus(callback) {
  getClient()
  statusListeners.add(callback)
  callback(status, previous)
  return () => statusListeners.delete(callback)
}

/**
 * S'abonne à un canal et réessaie si l'abonnement échoue pour une raison passagère.
 *
 *  - handler(payload)  : appelé à chaque événement reçu
 *  - onDenied()        : appelé si le serveur refuse (pas membre, session expirée…)
 *
 * Renvoie { stop() } pour se désabonner proprement.
 */
export function listen(channel, handler, { onDenied } = {}) {
  const subscription = getClient().subscription(channel)
  subscription.onMessage(handler)

  let stopped = false
  let timer = null

  async function attempt(n) {
    if (stopped) return
    lastFailure = 0
    await subscription.create()
    if (stopped || subscription.isCreated) return

    // refus définitif : inutile de réessayer
    if ([400, 401, 403, 404].includes(lastFailure)) {
      onDenied?.(lastFailure)
      return
    }
    // échec passager (réseau, serveur qui redémarre) : nouvel essai, de plus en plus espacé
    if (n < 8) timer = setTimeout(() => attempt(n + 1), Math.min(1000 * 2 ** n, 15000))
    else setStatus('failed')
  }

  attempt(0)

  return {
    stop() {
      stopped = true
      clearTimeout(timer)
      subscription.delete().catch(() => {})
    },
  }
}
