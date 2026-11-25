import { AuthTokensPolicy, isVerificationCode } from './auth.model';

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

describe('AuthTokensPolicy', () => {
  describe('isSignUp', () => {
    it.each([
      [true, true],
      [false, false],
      [null, false],
    ])('서버가 새 계정(%s)이라고 알렸을 때 가입인지 %s다', (isNewUser, expected) => {
      // Given
      const tokens = {
        userId: 'user-1',
        accessToken: 'access',
        refreshToken: 'refresh',
        userName: null,
        userProfileImage: null,
        accountRestored: false,
        isNewUser,
      };

      // When
      const result = AuthTokensPolicy.isSignUp(tokens);

      // Then
      expect(result).toBe(expected);
    });
  });
});
