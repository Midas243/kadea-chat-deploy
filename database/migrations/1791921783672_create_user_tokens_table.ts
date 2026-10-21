import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.enum('type', ['email_confirmation', 'password_reset']).notNullable()
      table.string('hash').notNullable() // jeton stocké haché, jamais en clair
      table.timestamp('expires_at').notNullable()
      table.timestamp('used_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'type'], 'user_tokens_user_id_type_index')
      table.index(['hash'], 'user_tokens_hash_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
