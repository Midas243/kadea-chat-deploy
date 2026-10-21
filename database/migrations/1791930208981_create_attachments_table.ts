import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'attachments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('messages')
        .onDelete('CASCADE')

      table.string('original_name').notNullable()
      table.string('storage_path').notNullable()
      table.string('mime_type').notNullable()
      table.integer('size').unsigned().notNullable() // en octets

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['message_id'], 'attachments_message_id_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
