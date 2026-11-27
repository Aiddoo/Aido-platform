import { PASSWORD_RULES } from '@aido/api/vocabulary';

import { getPasswordRuleChecks } from './password-rules.view-model';

describe('getPasswordRuleChecks', () => {
  it.each([
    ['a', true],
    ['Z', true],
    ['Password1', true],
    ['123456', false],
    ['!@#$%', false],
    ['', false],
  ])('"%s"가 영문을 포함하는지 %s다', (password, expected) => {
    // When
    const { hasLetter } = getPasswordRuleChecks(password);

    // Then
    expect(hasLetter).toBe(expected);
  });

  it.each([
    ['1', true],
    ['abc1', true],
    ['abc', false],
    ['!@#$%', false],
    ['', false],
  ])('"%s"가 숫자를 포함하는지 %s다', (password, expected) => {
    // When
    const { hasNumber } = getPasswordRuleChecks(password);

    // Then
    expect(hasNumber).toBe(expected);
  });

  it.each([
    [PASSWORD_RULES.MIN_LENGTH - 1, false],
    [PASSWORD_RULES.MIN_LENGTH, true],
    [PASSWORD_RULES.MIN_LENGTH + 1, true],
  ])('%i자가 최소 길이를 채우는지 %s다', (length, expected) => {
    // Given
    const password = '1'.repeat(length);

    // When
    const { hasMinLength } = getPasswordRuleChecks(password);

    // Then
    expect(hasMinLength).toBe(expected);
  });
});
