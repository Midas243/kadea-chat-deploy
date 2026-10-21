import vine from '@vinejs/vine'

const email = () => vine.string().trim().toLowerCase().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(64)

export const signupValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(80),
  email: email().unique({ table: 'users', column: 'email', caseInsensitive: true }),
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})

export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

export const emailValidator = vine.create({
  email: email(),
})

export const resetPasswordValidator = vine.create({
  password: password(),
  passwordConfirmation: password().sameAs('password'),
})
