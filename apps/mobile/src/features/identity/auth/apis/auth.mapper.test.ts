import { createAuthTokensDto } from '../__tests__/auth.fixtures';
import { toAuthTokens, toRegisterRequest } from './auth.mapper';

describe('toAuthTokens', () => {
  it('isNewUser가 없는 이메일 로그인 응답은 기존 로그인으로 본다', () => {
    // Given
    const dto = createAuthTokensDto();

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.isNewUser).toBe(false);
  });
});

describe('toRegisterRequest', () => {
  it.each([true, false])(
    '혜택·소식 동의(%s) 하나를 마케팅 정보·광고성 푸시 동의 둘에 같이 싣는다',
    (isMarketingAgreed) => {
      // When
      const request = toRegisterRequest({
        email: 'new@example.com',
        password: 'password-1',
        passwordConfirm: 'password-1',
        name: '새 사람',
        termsAgreed: true,
        privacyAgreed: true,
        isMarketingAgreed,
      });

      // Then
      expect(request).toMatchObject({
        marketingAgreed: isMarketingAgreed,
        marketingPushAgreed: isMarketingAgreed,
      });
      expect(request).not.toHaveProperty('isMarketingAgreed');
    },
  );
});
