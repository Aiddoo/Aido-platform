import { PASSWORD_RULES } from '@aido/api/vocabulary';

export function hasLetter(password: string) {
  return PASSWORD_RULES.HAS_LETTER.test(password);
}

export function hasNumber(password: string) {
  return PASSWORD_RULES.HAS_NUMBER.test(password);
}

export function hasMinLength(password: string) {
  return password.length >= PASSWORD_RULES.MIN_LENGTH;
}
