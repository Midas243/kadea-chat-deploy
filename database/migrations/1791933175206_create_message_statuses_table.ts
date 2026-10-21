import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'message_statuses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('received_at').nullable()
      table.timestamp('read_at').nullable()

      table.primary(['message_id', 'user_id'])
      table.index(['user_id'], 'message_statuses_user_id_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
