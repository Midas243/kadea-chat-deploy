/** Sélecteur de personnes : recherche, puces des personnes choisies, champs cachés memberIds[]. */
export function registerGroups(Alpine) {
  Alpine.data('userPicker', (config = {}) => ({
    q: '',
    results: [],
    selected: [],
    loading: false,
    searched: false,
    timer: null,

    onInput() {
      clearTimeout(this.timer)
      if (this.q.trim().length < 2) {
        this.results = []
        this.searched = false
        return
      }
      // on attend 250 ms après la dernière frappe pour ne pas interroger le serveur à chaque lettre
      this.timer = setTimeout(() => this.search(), 250)
    },

    async search() {
      const term = this.q.trim()
      this.loading = true
      try {
        const params = new URLSearchParams({ q: term })
        if (config.conversationId) params.set('conversationId', config.conversationId)
        const response = await fetch(`${config.searchUrl}?${params}`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        })
        const data = response.ok ? await response.json() : []
        if (term === this.q.trim()) {
          this.results = data.filter((u) => !this.isSelected(u.id))
        }
      } catch (e) {
        this.results = []
      } finally {
        this.loading = false
        this.searched = true
      }
    },

    isSelected(id) {
      return this.selected.some((u) => u.id === id)
    },

    add(user) {
      if (!this.isSelected(user.id)) this.selected.push(user)
      this.results = []
      this.q = ''
      this.searched = false
      this.$refs.search?.focus()
    },

    remove(id) {
      this.selected = this.selected.filter((u) => u.id !== id)
    },
  }))
}
