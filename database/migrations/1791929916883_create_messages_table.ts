import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('conversation_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('conversations')
        .onDelete('CASCADE')
      table
        .integer('sender_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      // nullable : un message peut contenir uniquement une pièce jointe
      table.text('content').nullable()

      // Suppression logique : si renseigné, on affiche « Message supprimé »
      table.timestamp('deleted_at').nullable()

      table.timestamp('created_at').notNullable() // = date_envoi
      table.timestamp('updated_at').nullable()

      // Historique d'une conversation, trié par date
      table.index(['conversation_id', 'created_at'], 'messages_conversation_id_created_at_index')
    })

    // Index plein texte PostgreSQL pour la recherche de mots dans les messages
    this.schema.raw(
      `CREATE INDEX messages_content_fulltext_index
       ON messages USING GIN (to_tsvector('french', coalesce(content, '')))`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
