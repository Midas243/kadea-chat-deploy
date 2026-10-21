import vine from '@vinejs/vine'

/** Création d'un groupe : un nom et au moins un autre membre. */
export const createGroupValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(60),
  memberIds: vine.array(vine.number().positive()).minLength(1).maxLength(50),
})

/** Ajout de membres à un groupe existant. */
export const addMembersValidator = vine.create({
  memberIds: vine.array(vine.number().positive()).minLength(1).maxLength(50),
})
