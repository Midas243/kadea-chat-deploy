import vine from '@vinejs/vine'

/** Modification du nom et de la photo (jpg, png ou webp, 2 Mo maximum). */
export const updateProfileValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(80),
  profilePicture: vine
    .file({ size: '2mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] })
    .optional(),
})

/** Changement de mot de passe : l'ancien est exigé, le nouveau doit être différent. */
export const updatePasswordValidator = vine.create({
  currentPassword: vine.string(),
  password: vine.string().minLength(8).maxLength(64).notSameAs('currentPassword'),
  passwordConfirmation: vine.string().sameAs('password'),
})
