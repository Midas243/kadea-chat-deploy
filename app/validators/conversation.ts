import vine from '@vinejs/vine'

export const startConversationValidator = vine.create({
  userId: vine.number().positive(),
})

export const messageValidator = vine.create({
  content: vine.string().trim().minLength(1).maxLength(2000),
})
