import { ConversationSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Member from '#models/member'
import Message from '#models/message'

export default class Conversation extends ConversationSchema {
  @belongsTo(() => User, { foreignKey: 'creatorId' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => Member)
  declare members: HasMany<typeof Member>

  @hasMany(() => Message)
  declare messages: HasMany<typeof Message>

  get isGroup() {
    return this.type === 'group'
  }
}
