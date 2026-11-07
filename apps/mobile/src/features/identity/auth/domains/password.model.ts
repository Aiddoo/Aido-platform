import { PASSWORD_RULES } from '@aido/api/vocabulary';

function hasLetter(password: string) {
  return PASSWORD_RULES.HAS_LETTER.test(password);
}

function hasNumber(password: string) {
  return PASSWORD_RULES.HAS_NUMBER.test(password);
}

function hasMinLength(password: string) {
  return password.length >= PASSWORD_RULES.MIN_LENGTH;
}

export const PasswordPolicy = {
  hasLetter,
  hasNumber,
  hasMinLength,
} as const;
