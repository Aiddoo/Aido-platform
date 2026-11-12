import { createAuthTokensDto, createDeleteAccountDto } from '../__tests__/auth.fixtures';
import {
  toAuthTokens,
  toDeleteAccountResult,
  toLinkedAccount,
  toRegisterRequest,
} from './auth.mapper';

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

describe('toDeleteAccountResult', () => {
  it('deletedAt ISO → Instant, gracePeriodDays 포함', () => {
    // Given
    const dto = createDeleteAccountDto({
      deletedAt: '2026-02-13T10:00:00.000Z',
      gracePeriodDays: 30,
    });

    // When
    const result = toDeleteAccountResult(dto);

    // Then
    expect(result.message).toBe(dto.message);
    expect(result.deletedAt).toBe('2026-02-13T10:00:00.000Z');
    expect(result.gracePeriodDays).toBe(30);
  });
});

describe('toLinkedAccount', () => {
  it('연결 시각은 ISO 문자열을 Instant로 바꿔 옮긴다', () => {
    // Given
    const dto = {
      provider: 'GOOGLE' as const,
      linked: true,
      providerAccountId: 'g-123',
      linkedAt: '2026-01-15T00:00:00.000Z',
    };

    // When
    const result = toLinkedAccount(dto);

    // Then
    expect(result.linkedAt).toBe('2026-01-15T00:00:00.000Z');
    expect(result.provider).toBe('GOOGLE');
    expect(result.linked).toBe(true);
  });

  it('연결 시각이 없으면 비워 두고 계정 id도 비운다', () => {
    // Given
    const dto = {
      provider: 'KAKAO' as const,
      linked: false,
      providerAccountId: null,
      linkedAt: null,
    };

    // When
    const result = toLinkedAccount(dto);

    // Then
    expect(result.linkedAt).toBeNull();
    expect(result.providerAccountId).toBeNull();
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
