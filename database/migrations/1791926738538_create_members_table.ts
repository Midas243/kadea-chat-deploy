import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('conversation_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.enum('role', ['admin', 'member']).notNullable().defaultTo('member')
      table.timestamp('added_at').notNullable()
      table.timestamp('last_read_at').nullable() // sert à calculer les messages non lus

      // Clé primaire composite : un utilisateur ne peut être qu'une fois dans une conversation
      table.primary(['conversation_id', 'user_id'])

      // Pour lister rapidement les conversations d'un utilisateur
      table.index(['user_id'], 'members_user_id_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
