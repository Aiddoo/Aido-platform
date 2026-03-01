import {
  createAuthTokensDto,
  createChangePasswordDto,
  createConsentDto,
  createDeleteAccountDto,
  createForgotPasswordDto,
  createLinkedAccountsDto,
  createRegisterDto,
  createResendVerificationDto,
  createResetPasswordDto,
  createUpdateMarketingConsentDto,
} from '../__tests__/auth.factories';
import {
  toAuthTokens,
  toChangePasswordResult,
  toConsent,
  toDeleteAccountResult,
  toForgotPasswordResult,
  toLinkedAccount,
  toLinkedAccounts,
  toPreference,
  toRegisterResult,
  toResendVerificationResult,
  toResetPasswordResult,
  toUpdateMarketingConsentResult,
} from './auth.mapper';

describe('toAuthTokens', () => {
  test('name → userName, profileImage → userProfileImage 매핑', () => {
    // Given
    const dto = createAuthTokensDto({
      name: '홍길동',
      profileImage: 'https://example.com/avatar.jpg',
    });

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result).toEqual({
      userId: dto.userId,
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      userName: '홍길동',
      userProfileImage: 'https://example.com/avatar.jpg',
      accountRestored: false,
    });
  });

  test('null 필드 유지', () => {
    // Given
    const dto = createAuthTokensDto({ name: null, profileImage: null });

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.userName).toBeNull();
    expect(result.userProfileImage).toBeNull();
  });

  test('accountRestored undefined → false 기본값', () => {
    // Given
    const dto = createAuthTokensDto();
    // accountRestored는 DTO에 없는 필드 → undefined

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.accountRestored).toBe(false);
  });

  test('accountRestored true → true 유지', () => {
    // Given
    const dto = createAuthTokensDto({ accountRestored: true });

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.accountRestored).toBe(true);
  });
});

describe('toPreference', () => {
  test('preference 필드 전체 매핑', () => {
    // Given
    const dto = {
      pushEnabled: true,
      nightPushEnabled: false,
      timezone: 'Asia/Seoul',
      morningReminderHour: 8,
      eveningReminderHour: 21,
    };

    // When
    const result = toPreference(dto);

    // Then
    expect(result).toEqual({
      pushEnabled: true,
      nightPushEnabled: false,
      morningReminderHour: 8,
      eveningReminderHour: 21,
    });
    expect(result).not.toHaveProperty('timezone');
  });
});

describe('toConsent', () => {
  test('ISO 문자열 → Date 변환', () => {
    // Given
    const dto = createConsentDto({
      termsAgreedAt: '2026-01-01T00:00:00.000Z',
      privacyAgreedAt: '2026-01-01T00:00:00.000Z',
      marketingAgreedAt: '2026-02-01T00:00:00.000Z',
    });

    // When
    const result = toConsent(dto);

    // Then
    expect(result.termsAgreedAt).toBeInstanceOf(Date);
    expect(result.privacyAgreedAt).toBeInstanceOf(Date);
    expect(result.marketingAgreedAt).toBeInstanceOf(Date);
    expect(result.termsAgreedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  test('null → null 유지', () => {
    // Given
    const dto = createConsentDto({
      termsAgreedAt: null,
      privacyAgreedAt: null,
      marketingAgreedAt: null,
    });

    // When
    const result = toConsent(dto);

    // Then
    expect(result.termsAgreedAt).toBeNull();
    expect(result.privacyAgreedAt).toBeNull();
    expect(result.marketingAgreedAt).toBeNull();
  });

  test('agreedTermsVersion 유지', () => {
    // Given
    const dto = createConsentDto({ agreedTermsVersion: '2.0.0' });

    // When
    const result = toConsent(dto);

    // Then
    expect(result.agreedTermsVersion).toBe('2.0.0');
  });
});

describe('toRegisterResult', () => {
  test('message, email 매핑', () => {
    // Given
    const dto = createRegisterDto();

    // When
    const result = toRegisterResult(dto);

    // Then
    expect(result).toEqual({
      message: dto.message,
      email: dto.email,
    });
  });
});

describe('toResendVerificationResult', () => {
  test('retryAfterSeconds 포함', () => {
    // Given
    const dto = createResendVerificationDto({ retryAfterSeconds: 120 });

    // When
    const result = toResendVerificationResult(dto);

    // Then
    expect(result).toEqual({
      message: dto.message,
      email: dto.email,
      retryAfterSeconds: 120,
    });
  });

  test('retryAfterSeconds undefined → undefined', () => {
    // Given
    const dto = createResendVerificationDto({ retryAfterSeconds: undefined });

    // When
    const result = toResendVerificationResult(dto);

    // Then
    expect(result.retryAfterSeconds).toBeUndefined();
  });
});

describe('toUpdateMarketingConsentResult', () => {
  test('ISO → Date 변환', () => {
    // Given
    const dto = createUpdateMarketingConsentDto({
      marketingAgreedAt: '2026-02-01T00:00:00.000Z',
    });

    // When
    const result = toUpdateMarketingConsentResult(dto);

    // Then
    expect(result.marketingAgreedAt).toBeInstanceOf(Date);
    expect(result.marketingAgreedAt?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  test('null → null (마케팅 동의 철회)', () => {
    // Given
    const dto = createUpdateMarketingConsentDto({ marketingAgreedAt: null });

    // When
    const result = toUpdateMarketingConsentResult(dto);

    // Then
    expect(result.marketingAgreedAt).toBeNull();
  });
});

describe('toDeleteAccountResult', () => {
  test('deletedAt ISO → Date, gracePeriodDays 포함', () => {
    // Given
    const dto = createDeleteAccountDto({
      deletedAt: '2026-02-13T10:00:00.000Z',
      gracePeriodDays: 30,
    });

    // When
    const result = toDeleteAccountResult(dto);

    // Then
    expect(result.message).toBe(dto.message);
    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(result.deletedAt.toISOString()).toBe('2026-02-13T10:00:00.000Z');
    expect(result.gracePeriodDays).toBe(30);
  });
});

describe('toForgotPasswordResult', () => {
  test('message 매핑', () => {
    // Given
    const dto = createForgotPasswordDto();

    // When
    const result = toForgotPasswordResult(dto);

    // Then
    expect(result).toEqual({ message: dto.message });
  });
});

describe('toResetPasswordResult', () => {
  test('message 매핑', () => {
    // Given
    const dto = createResetPasswordDto();

    // When
    const result = toResetPasswordResult(dto);

    // Then
    expect(result).toEqual({ message: dto.message });
  });
});

describe('toChangePasswordResult', () => {
  test('message 매핑', () => {
    // Given
    const dto = createChangePasswordDto();

    // When
    const result = toChangePasswordResult(dto);

    // Then
    expect(result).toEqual({ message: dto.message });
  });
});

describe('toLinkedAccount', () => {
  test('linkedAt ISO → Date', () => {
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
    expect(result.linkedAt).toBeInstanceOf(Date);
    expect(result.linkedAt?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(result.provider).toBe('GOOGLE');
    expect(result.linked).toBe(true);
  });

  test('linkedAt null → null', () => {
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

describe('toLinkedAccounts', () => {
  test('배열 변환', () => {
    // Given
    const dto = createLinkedAccountsDto();

    // When
    const result = toLinkedAccounts(dto);

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]?.provider).toBe('GOOGLE');
    expect(result[1]?.provider).toBe('KAKAO');
  });

  test('빈 배열 → 빈 배열', () => {
    // Given
    const dto = { accounts: [] };

    // When
    const result = toLinkedAccounts(dto);

    // Then
    expect(result).toEqual([]);
  });
});
