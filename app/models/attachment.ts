import { AttachmentSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Message from '#models/message'

export default class Attachment extends AttachmentSchema {
  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>
}
