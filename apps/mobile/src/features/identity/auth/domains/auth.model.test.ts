import { PASSWORD_RULES } from '@aido/api/vocabulary';

import { PasswordPolicy } from './auth.model';

describe('PasswordPolicy', () => {
  describe('hasLetter', () => {
    test.each(['a', 'Z', 'Password1'])('"%s"는 영문을 포함하므로 true', (pw) => {
      expect(PasswordPolicy.hasLetter(pw)).toBe(true);
    });

    test.each(['123456', '!@#$%', ''])('"%s"는 영문이 없으므로 false', (pw) => {
      expect(PasswordPolicy.hasLetter(pw)).toBe(false);
    });
  });

  describe('hasNumber', () => {
    test.each(['1', 'abc1', 'Password1'])('"%s"는 숫자를 포함하므로 true', (pw) => {
      expect(PasswordPolicy.hasNumber(pw)).toBe(true);
    });

    test.each(['abc', '!@#$%', ''])('"%s"는 숫자가 없으므로 false', (pw) => {
      expect(PasswordPolicy.hasNumber(pw)).toBe(false);
    });
  });

  describe('hasMinLength', () => {
    test('최소 길이 이상이면 true', () => {
      expect(PasswordPolicy.hasMinLength('1'.repeat(PASSWORD_RULES.MIN_LENGTH))).toBe(true);
      expect(PasswordPolicy.hasMinLength('1'.repeat(PASSWORD_RULES.MIN_LENGTH + 1))).toBe(true);
    });

    test('최소 길이 미만이면 false', () => {
      expect(PasswordPolicy.hasMinLength('1'.repeat(PASSWORD_RULES.MIN_LENGTH - 1))).toBe(false);
      expect(PasswordPolicy.hasMinLength('')).toBe(false);
    });
  });

  describe('PasswordPolicy (composed)', () => {
    const validPassword = 'Password1';

    test('유효한 비밀번호는 모든 규칙을 통과한다', () => {
      expect(PasswordPolicy.hasLetter(validPassword)).toBe(true);
      expect(PasswordPolicy.hasNumber(validPassword)).toBe(true);
      expect(PasswordPolicy.hasMinLength(validPassword)).toBe(true);
    });

    test('영문 없으면 hasLetter가 false', () => {
      expect(PasswordPolicy.hasLetter('12345678')).toBe(false);
    });

    test('숫자 없으면 hasNumber가 false', () => {
      expect(PasswordPolicy.hasNumber('Password')).toBe(false);
    });

    test('8자 미만이면 hasMinLength가 false', () => {
      expect(PasswordPolicy.hasMinLength('Pass1')).toBe(false);
    });
  });
});
