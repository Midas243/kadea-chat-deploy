import { Transmit } from '@adonisjs/transmit-client'

let transmit = null

/** Une seule connexion temps réel par page, créée au premier besoin. */
function getTransmit() {
  if (!transmit) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content ?? ''
    const addToken = (request) => request.headers.set('X-CSRF-TOKEN', token)
    transmit = new Transmit({
      baseUrl: window.location.origin,
      beforeSubscribe: addToken,
      beforeUnsubscribe: addToken,
    })
  }
  return transmit
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
    subscription: null,

    async init() {
      try {
        this.subscription = getTransmit().subscription(`users/${this.userId}`)
        this.subscription.onMessage((event) => this.onEvent(event))
        await this.subscription.create()
      } catch (e) {
        // la liste se mettra à jour au prochain rechargement
      }
    },

    destroy() {
      this.subscription?.delete().catch(() => {})
    },

    csrfHeaders() {
      const token = document.querySelector('meta[name="csrf-token"]')?.content ?? ''
      return { 'X-CSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' }
    },

    async onEvent(event) {
      const id = event.conversationId
      const isActive = id === this.activeId

      // retiré d'un groupe : la carte disparaît et, si elle était ouverte, on quitte la page
      if (event.type === 'conversation.removed') {
        this.$root.querySelector(`.conv-card[data-conversation-id="${id}"]`)?.remove()
        if (isActive) window.location.href = this.listUrl
        return
      }
      if (event.type !== 'conversation.updated') return

      try {
        // la conversation est ouverte à l'écran : le message est lu tout de suite
        if (isActive) {
          await fetch(this.readUrl.replace('__ID__', id), {
            method: 'POST',
            headers: this.csrfHeaders(),
            credentials: 'same-origin',
          })
        }

        const response = await fetch(`${this.cardUrl.replace('__ID__', id)}?active=${isActive ? 1 : 0}`, {
          headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'same-origin',
        })
        if (response.status === 403 || response.status === 404) {
          // plus d'accès à cette conversation
          this.$root.querySelector(`.conv-card[data-conversation-id="${id}"]`)?.remove()
          if (isActive) window.location.href = this.listUrl
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

      this.$root.querySelector(`.conv-card[data-conversation-id="${id}"]`)?.remove()
      this.$root.querySelector('[data-list-empty]')?.remove()
      label.insertAdjacentHTML('afterend', html)
    },
  }))

  Alpine.data('chatRoom', (config) => ({
    conversationId: config.conversationId,
    fragmentUrl: config.fragmentUrl, // ex. "/messages/__ID__"
    sending: false,
    sent: false,
    error: '',
    subscription: null,
    wasDisconnected: false,

    async init() {
      this.scrollToBottom()
      try {
        this.subscription = getTransmit().subscription(`conversations/${this.conversationId}`)
        this.subscription.onMessage((event) => this.onEvent(event))
        await this.subscription.create()
        this.watchConnection()
      } catch (e) {
        this.error = 'Connexion en direct indisponible : rechargez la page.'
      }
    },

    /** Après une coupure de connexion, les messages manqués sont récupérés en rechargeant. */
    watchConnection() {
      try {
        const t = getTransmit()
        t.on('disconnected', () => {
          this.wasDisconnected = true
        })
        t.on('connected', () => {
          if (!this.wasDisconnected) return
          this.wasDisconnected = false
          const draft = this.$root.querySelector('textarea[name="content"]')?.value.trim()
          if (draft) this.error = 'Connexion rétablie : envoyez votre message puis rechargez la page.'
          else window.location.reload()
        })
      } catch (e) {
        // sans cet écouteur, seul le rattrapage automatique est perdu
      }
    },

    destroy() {
      this.subscription?.delete().catch(() => {})
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
        headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error('fragment')
      return response.text()
    },

    /** Reçoit un événement du canal : « message.created » ou « message.deleted ». */
    async onEvent(event) {
      try {
        if (event.type === 'message.created') {
          if (this.findBubble(event.messageId)) return // déjà affiché
          const wasNearBottom = this.isNearBottom()
          const html = await this.fetchBubble(event.messageId)
          if (this.findBubble(event.messageId)) return
          this.list.querySelector('.empty')?.remove()
          this.list.insertAdjacentHTML('beforeend', html)
          const added = this.list.lastElementChild
          if (wasNearBottom || added?.classList.contains('msg--out')) this.scrollToBottom()
        } else if (event.type === 'message.deleted') {
          const current = this.findBubble(event.messageId)
          if (!current) return
          current.outerHTML = await this.fetchBubble(event.messageId)
        }
      } catch (e) {
        // en cas d'échec ponctuel, un rechargement de la page remet tout à jour
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
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'same-origin',
        })
        if (!response.ok) throw new Error('send')
        input.value = ''
        input.focus()
        this.sent = true // petite coche de confirmation
        setTimeout(() => (this.sent = false), 1400)
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
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'same-origin',
        })
        if (!response.ok) throw new Error('delete')
      } catch (e) {
        this.error = "La suppression a échoué. Réessayez."
      }
    },
  }))
}
