import { isVerificationCode } from './auth.model';

describe('isVerificationCode', () => {
  it.each([
    ['123456', true],
    ['12345', false],
    ['1234567', false],
    ['12345a', false],
    ['１２３４５６', false],
  ])('%s는 보낼 수 있는 인증 코드인지 %s다', (code, expected) => {
    // When
    const result = isVerificationCode(code);

    // Then
    expect(result).toBe(expected);
  });
});
