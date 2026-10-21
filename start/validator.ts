import { DateTime } from 'luxon'
import vine, { SimpleMessagesProvider, VineDate } from '@vinejs/vine'

declare module '@vinejs/vine/types' {
  interface VineGlobalTransforms {
    date: DateTime
  }
}

VineDate.transform((value) => DateTime.fromJSDate(value))

vine.messagesProvider = new SimpleMessagesProvider(
  {
    'required': 'Le champ {{ field }} est obligatoire.',
    'string': 'Le champ {{ field }} doit être un texte.',
    'email': 'Saisissez une adresse e-mail valide.',
    'minLength': 'Le champ {{ field }} doit contenir au moins {{ min }} caractères.',
    'maxLength': 'Le champ {{ field }} ne doit pas dépasser {{ max }} caractères.',
    'sameAs': 'Les mots de passe ne correspondent pas.',
    'database.unique': 'Cette {{ field }} est déjà utilisée.',
  },
  {
    fullName: 'nom complet',
    name: 'nom du groupe',
    email: 'adresse e-mail',
    password: 'mot de passe',
    passwordConfirmation: 'confirmation du mot de passe',
  }
)
