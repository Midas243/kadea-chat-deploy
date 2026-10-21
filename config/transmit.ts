import { defineConfig } from '@adonisjs/transmit'

export default defineConfig({
  // Un signe de vie toutes les 30 s : sans lui, les proxys d'hébergement
  // (Railway, Render, Nginx…) coupent la connexion SSE quand elle reste silencieuse.
  pingInterval: '30s',
  // Une seule instance du serveur : pas besoin de transport (Redis) pour l'instant.
  transport: null,
})
