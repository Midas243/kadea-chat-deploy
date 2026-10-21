import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'blocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('blocker_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('blocked_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('created_at').notNullable() // = date_blocage

      table.primary(['blocker_id', 'blocked_id'])
      table.index(['blocked_id'], 'blocks_blocked_id_index')
      table.check('?? <> ??', ['blocker_id', 'blocked_id'], 'blocks_no_self_block')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
