import { listen, onStatus, ajaxHeaders } from './realtime.js'

const HTML_HEADERS = { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' }
const JSON_HEADERS = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }

/** Transforme un morceau de HTML en élément DOM. */
function toElement(html) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()
  return template.content.firstElementChild
}

export function registerChat(Alpine) {
  /**
   * Barre latérale : écoute le canal personnel « users/:id ».
   * À chaque changement, on récupère la carte HTML de la conversation concernée
   * et on la remonte en haut de la liste (avec son badge « non lus »).
   */
  Alpine.data('chatSidebar', (config) => ({
    userId: config.userId,
    activeId: config.activeId,
    cardUrl: config.cardUrl, // ex. "/conversations/__ID__/card"
    readUrl: config.readUrl, // ex. "/conversations/__ID__/read"
    listUrl: config.listUrl || '/conversations',
    channel: null,
    stopStatus: null,

    init() {
      this.channel = listen(`users/${this.userId}`, (event) => this.onEvent(event))

      // après une coupure, la liste est rafraîchie sans recharger la page
      this.stopStatus = onStatus((status, previous) => {
        if (status === 'connected' && previous === 'reconnecting') this.refreshList()
      })
    },

    destroy() {
      this.channel?.stop()
      this.stopStatus?.()
    },

    cardSelector(id) {
      return `.conv-card[data-conversation-id="${id}"]`
    },

    leave() {
      window.location.href = this.listUrl
    },

    async onEvent(event) {
      const id = event.conversationId
      const isActive = id === this.activeId

      // retiré d'un groupe : la carte disparaît et, si elle était ouverte, on quitte la page
      if (event.type === 'conversation.removed') {
        this.$root.querySelector(this.cardSelector(id))?.remove()
        if (isActive) this.leave()
        return
      }
      if (event.type !== 'conversation.updated') return

      try {
        // la conversation est ouverte à l'écran : le message est lu tout de suite
        if (isActive) {
          await fetch(this.readUrl.replace('__ID__', id), {
            method: 'POST',
            headers: ajaxHeaders(),
            credentials: 'same-origin',
          })
        }

        const response = await fetch(
          `${this.cardUrl.replace('__ID__', id)}?active=${isActive ? 1 : 0}`,
          { headers: HTML_HEADERS, credentials: 'same-origin' }
        )
        if (response.status === 403 || response.status === 404) {
          // plus d'accès à cette conversation
          this.$root.querySelector(this.cardSelector(id))?.remove()
          if (isActive) this.leave()
          return
        }
        if (!response.ok) return
        this.placeCard(id, await response.text())
      } catch (e) {
        // un rechargement de la page remet la liste à jour
      }
    },

    /** Remplace l'ancienne carte et place la nouvelle en haut de la liste. */
    placeCard(id, html) {
      const label = this.$root.querySelector('[data-list-label]')
      if (!label) return // liste masquée (résultats de recherche affichés)

      this.$root.querySelector(this.cardSelector(id))?.remove()
      this.$root.querySelector('[data-list-empty]')?.remove()
      label.insertAdjacentHTML('afterend', html)
    },

    /** Après une reconnexion : on relit la page courante et on remplace la liste. */
    async refreshList() {
      try {
        const label = this.$root.querySelector('[data-list-label]')
        if (!label) return // recherche en cours : on ne touche pas
        const response = await fetch(window.location.href, {
          headers: HTML_HEADERS,
          credentials: 'same-origin',
        })
        if (!response.ok) return
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
        const fresh = doc.querySelector('.chat__list')
        const current = this.$root.querySelector('.chat__list')
        if (fresh && current) current.innerHTML = fresh.innerHTML
      } catch (e) {
        // la prochaine mise à jour en direct corrigera la liste
      }
    },
  }))

  /**
   * Une conversation ouverte : reçoit « message.created » et « message.deleted »,
   * envoie les messages en fetch, rattrape les messages manqués après une coupure.
   */
  Alpine.data('chatRoom', (config) => ({
    conversationId: config.conversationId,
    fragmentUrl: config.fragmentUrl, // ex. "/messages/__ID__"
    sending: false,
    sent: false,
    live: 'connecting', // état de la connexion en direct
    channel: null,
    stopStatus: null,
    _error: '',

    /**
     * `error` est lu par le gabarit (<p x-text="error">). C'est un getter :
     * une erreur d'envoi est prioritaire, sinon on affiche l'état de la connexion.
     */
    get error() {
      if (this._error) return this._error
      if (this.live === 'reconnecting') return 'Connexion en direct perdue. Reconnexion…'
      if (this.live === 'failed') return 'Connexion en direct perdue. Rechargez la page.'
      return ''
    },
    set error(value) {
      this._error = value
    },

    init() {
      this.scrollToBottom()

      this.channel = listen(
        `conversations/${this.conversationId}`,
        (event) => this.onEvent(event),
        // accès refusé (retiré du groupe, conversation inconnue) : retour à la liste
        { onDenied: () => (window.location.href = '/conversations') }
      )

      this.stopStatus = onStatus((status, previous) => {
        this.live = status
        // les messages arrivés pendant la coupure sont récupérés sans recharger
        if (status === 'connected' && previous === 'reconnecting') this.catchUp()
      })
    },

    destroy() {
      this.channel?.stop()
      this.stopStatus?.()
    },

    get list() {
      return this.$refs.list
    },

    scrollToBottom() {
      this.$nextTick(() => {
        this.list.scrollTop = this.list.scrollHeight
      })
    },

    isNearBottom() {
      const el = this.list
      return el.scrollHeight - el.scrollTop - el.clientHeight < 140
    },

    findBubble(id) {
      return this.list.querySelector(`[data-message-id="${id}"]`)
    },

    async fetchBubble(id) {
      const response = await fetch(this.fragmentUrl.replace('__ID__', id), {
        headers: HTML_HEADERS,
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error('fragment')
      return response.text()
    },

    /**
     * Place une bulle à sa position : avant la première bulle d'id plus grand,
     * sinon à la fin. Deux événements qui arrivent dans le désordre restent donc triés.
     */
    insertBubble(id, element) {
      this.list.querySelector('.empty')?.remove()
      const next = [...this.list.querySelectorAll('[data-message-id]')].find(
        (el) => Number(el.dataset.messageId) > id
      )
      if (next) next.before(element)
      else this.list.append(element)
    },

    /** Affiche un message (sans doublon). Renvoie la bulle ajoutée, ou null si déjà présente. */
    async addMessage(id) {
      if (this.findBubble(id)) return null
      const wasNearBottom = this.isNearBottom()
      const element = toElement(await this.fetchBubble(id))
      if (!element || this.findBubble(id)) return null // arrivé entre-temps

      this.insertBubble(id, element)
      if (wasNearBottom || element.classList.contains('msg--out')) this.scrollToBottom()
      return element
    },

    /** Remplace une bulle par sa version à jour (message supprimé). */
    async refreshMessage(id) {
      const current = this.findBubble(id)
      if (!current) return
      const element = toElement(await this.fetchBubble(id))
      if (element) current.replaceWith(element)
    },

    /** Événements du canal : « message.created » ou « message.deleted ». */
    async onEvent(event) {
      try {
        if (event.type === 'message.created') await this.addMessage(event.messageId)
        else if (event.type === 'message.deleted') await this.refreshMessage(event.messageId)
      } catch (e) {
        // échec ponctuel : le prochain rattrapage ou un rechargement remet tout à jour
      }
    },

    /**
     * Après une coupure : on relit la page de la conversation (la même que celle du
     * rechargement) et on ajoute ce qui manque ou a été supprimé, sans perdre le brouillon.
     */
    async catchUp() {
      try {
        const response = await fetch(window.location.pathname, {
          headers: HTML_HEADERS,
          credentials: 'same-origin',
        })
        if (response.status === 403 || response.status === 404) {
          window.location.href = '/conversations'
          return
        }
        if (!response.ok) return

        const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
        const wasNearBottom = this.isNearBottom()
        for (const node of doc.querySelectorAll('.chat__messages [data-message-id]')) {
          const id = Number(node.dataset.messageId)
          const current = this.findBubble(id)
          const element = document.importNode(node, true)
          if (!current) this.insertBubble(id, element)
          else if (node.querySelector('.bubble--deleted') && !current.querySelector('.bubble--deleted'))
            current.replaceWith(element)
        }
        if (wasNearBottom) this.scrollToBottom()
      } catch (e) {
        // un rechargement manuel reste possible
      }
    },

    /** Envoi du message sans recharger la page. */
    async send(event) {
      event.preventDefault()
      if (this.sending) return
      const form = event.target
      const input = form.querySelector('textarea[name="content"]')
      if (!input.value.trim()) return

      this.sending = true
      this.error = ''
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: JSON_HEADERS,
          credentials: 'same-origin',
        })
        if (!response.ok) throw new Error('send')
        const { id } = await response.json()

        input.value = ''
        input.focus()
        this.sent = true // petite coche de confirmation
        setTimeout(() => (this.sent = false), 1400)

        // on n'attend pas l'écho du canal : le message s'affiche tout de suite
        this.addMessage(id).catch(() => {})
      } catch (e) {
        this.error = "Le message n'a pas pu être envoyé. Réessayez."
      } finally {
        this.sending = false
      }
    },

    /** Suppression d'un message (les formulaires « Supprimer » sont dans la liste). */
    async onListSubmit(event) {
      const form = event.target
      if (!form.classList.contains('msg__del')) return
      event.preventDefault()
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: JSON_HEADERS,
          credentials: 'same-origin',
        })
        if (!response.ok) throw new Error('delete')
        // même logique que pour l'envoi : pas besoin d'attendre le canal
        const id = Number(form.closest('[data-message-id]')?.dataset.messageId)
        if (id) this.refreshMessage(id).catch(() => {})
      } catch (e) {
        this.error = 'La suppression a échoué. Réessayez.'
      }
    },
  }))
}
