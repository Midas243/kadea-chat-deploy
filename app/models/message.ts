import { MessageSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Conversation from '#models/conversation'
import Attachment from '#models/attachment'
import MessageStatus from '#models/message_status'

export default class Message extends MessageSchema {
  @belongsTo(() => User, { foreignKey: 'senderId' })
  declare sender: BelongsTo<typeof User>

  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @hasMany(() => Attachment)
  declare attachments: HasMany<typeof Attachment>

  @hasMany(() => MessageStatus)
  declare statuses: HasMany<typeof MessageStatus>

  get isDeleted() {
    return this.deletedAt !== null
  }
}
