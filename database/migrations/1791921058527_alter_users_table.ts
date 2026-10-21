import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('profile_picture').nullable()
      table.timestamp('email_verified_at').nullable()
      table.timestamp('last_login_at').nullable()
    })

    // Index pour la recherche d'utilisateurs par nom
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['full_name'], 'users_full_name_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['full_name'], 'users_full_name_index')
      table.dropColumn('profile_picture')
      table.dropColumn('email_verified_at')
      table.dropColumn('last_login_at')
    })
  }
}
