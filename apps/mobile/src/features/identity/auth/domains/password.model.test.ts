import { PASSWORD_RULES } from '@aido/api/vocabulary';

import { hasLetter, hasMinLength, hasNumber } from './password.model';

describe('hasLetter', () => {
  it.each(['a', 'Z', 'Password1'])('"%s"는 영문을 포함하므로 true를 반환한다', (password) => {
    // When
    const result = hasLetter(password);

    // Then
    expect(result).toBe(true);
  });

  it.each(['123456', '!@#$%', ''])('"%s"는 영문이 없으므로 false를 반환한다', (password) => {
    // When
    const result = hasLetter(password);

    // Then
    expect(result).toBe(false);
  });
});

describe('hasNumber', () => {
  it.each(['1', 'abc1', 'Password1'])('"%s"는 숫자를 포함하므로 true를 반환한다', (password) => {
    // When
    const result = hasNumber(password);

    // Then
    expect(result).toBe(true);
  });

  it.each(['abc', '!@#$%', ''])('"%s"는 숫자가 없으므로 false를 반환한다', (password) => {
    // When
    const result = hasNumber(password);

    // Then
    expect(result).toBe(false);
  });
});

describe('hasMinLength', () => {
  it.each([PASSWORD_RULES.MIN_LENGTH, PASSWORD_RULES.MIN_LENGTH + 1])(
    '%i자는 최소 길이 이상이므로 true를 반환한다',
    (length) => {
      // Given
      const password = '1'.repeat(length);

      // When
      const result = hasMinLength(password);

      // Then
      expect(result).toBe(true);
    },
  );

  it.each([PASSWORD_RULES.MIN_LENGTH - 1, 0])(
    '%i자는 최소 길이 미만이므로 false를 반환한다',
    (length) => {
      // Given
      const password = '1'.repeat(length);

      // When
      const result = hasMinLength(password);

      // Then
      expect(result).toBe(false);
    },
  );
});
