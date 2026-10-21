
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'

router.on('/').render('pages/home').as('home')

// Temps réel : seuls les utilisateurs connectés peuvent s'abonner
transmit.registerRoutes((route) => {
  const pattern = route.getPattern()

  if (
    pattern.includes('__transmit/subscribe') ||
    pattern.includes('__transmit/unsubscribe')
  ) {
    route.middleware(middleware.auth())
  }
})

// Confirmation de l'adresse e-mail
router
  .get('verify-email/:token', [controllers.EmailVerification, 'verify'])
  .as('verification.verify')

// Routes accessibles aux visiteurs non connectés
router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router
      .post('signup', [controllers.NewAccount, 'store'])
      .use(middleware.throttle({ name: 'signup', max: 30, minutes: 60 }))

    router.get('login', [controllers.Session, 'create'])
    router
      .post('login', [controllers.Session, 'store'])
      .use(middleware.throttle({
        name: 'login',
        max: 5,
        minutes: 15,
        perEmail: true,
      }))

    router
      .get('verify-email', [controllers.EmailVerification, 'notice'])
      .as('verification.notice')

    router
      .post('verify-email/resend', [controllers.EmailVerification, 'resend'])
      .as('verification.resend')
      .use(middleware.throttle({
        name: 'resend',
        max: 3,
        minutes: 15,
        perEmail: true,
      }))

    router
      .get('forgot-password', [controllers.PasswordReset, 'forgot'])
      .as('password.forgot')

    router
      .post('forgot-password', [controllers.PasswordReset, 'send'])
      .as('password.send')
      .use(middleware.throttle({
        name: 'forgot',
        max: 3,
        minutes: 15,
        perEmail: true,
      }))

    router
      .get('reset-password/:token', [controllers.PasswordReset, 'edit'])
      .as('password.edit')

    router
      .post('reset-password/:token', [controllers.PasswordReset, 'update'])
      .as('password.update')
  })
  .use(middleware.guest())

// Routes réservées aux utilisateurs connectés
router
  .group(() => {
    router
      .get('/dashboard', ({ response }) =>
        response.redirect().toRoute('conversations.index')
      )
      .as('dashboard')

    // Conversations
    router
      .get('conversations', [controllers.Conversations, 'index'])
      .as('conversations.index')

    router
      .post('conversations', [controllers.Conversations, 'store'])
      .as('conversations.store')

    router
      .get('conversations/:id', [controllers.Conversations, 'show'])
      .as('conversations.show')

    router
      .get('conversations/:id/card', [controllers.Conversations, 'card'])
      .as('conversations.card')

    router
      .post('conversations/:id/read', [controllers.Conversations, 'read'])
      .as('conversations.read')

    // Messages
    router
      .post('conversations/:conversationId/messages', [
        controllers.Messages,
        'store',
      ])
      .as('messages.store')

    router
      .get('messages/:id', [controllers.Messages, 'show'])
      .as('messages.show')

    router
      .delete('messages/:id', [controllers.Messages, 'destroy'])
      .as('messages.destroy')

    // Recherche d'utilisateurs
    router
      .get('users/search', [controllers.UserSearch, 'index'])
      .as('users.search')

    // Groupes
    router
      .get('groups/new', [controllers.Groups, 'create'])
      .as('groups.create')

    router
      .post('groups', [controllers.Groups, 'store'])
      .as('groups.store')

    router
      .get('groups/:id', [controllers.Groups, 'show'])
      .as('groups.show')

    router
      .post('groups/:id/members', [controllers.Groups, 'addMembers'])
      .as('groups.members.add')

    router
      .delete('groups/:id/members/:userId', [
        controllers.Groups,
        'removeMember',
      ])
      .as('groups.members.remove')

    // Profil utilisateur
    router
      .get('profile', [controllers.Profile, 'edit'])
      .as('profile.edit')

    router
      .post('profile', [controllers.Profile, 'update'])
      .as('profile.update')

    router
      .post('profile/password', [controllers.Profile, 'updatePassword'])
      .as('profile.password')

    // Déconnexion
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
