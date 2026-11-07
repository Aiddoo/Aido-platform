import {
  createAuthTokensDto,
  createChangePasswordDto,
  createDeleteAccountDto,
  createForgotPasswordDto,
  createLinkedAccountsDto,
  createRegisterDto,
  createResendVerificationDto,
  createResetPasswordDto,
} from '../__tests__/auth.fixtures';
import {
  toAuthTokens,
  toChangePasswordResult,
  toDeleteAccountResult,
  toForgotPasswordResult,
  toLinkedAccount,
  toLinkedAccounts,
  toRegisterResult,
  toResendVerificationResult,
  toResetPasswordResult,
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
      isNewUser: false,
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

  test('isNewUser가 없는 구버전 서버 응답은 기존 로그인으로 본다', () => {
    // Given
    const dto = createAuthTokensDto();

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.isNewUser).toBe(false);
  });

  test('isNewUser true → true 유지', () => {
    // Given
    const dto = createAuthTokensDto({ isNewUser: true });

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.isNewUser).toBe(true);
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
      isEmailSent: true,
    });
  });

  test('인증 메일을 보내지 못했다는 응답을 그대로 옮긴다', () => {
    // Given
    const dto = createRegisterDto({ emailSent: false });

    // When
    const result = toRegisterResult(dto);

    // Then
    expect(result.isEmailSent).toBe(false);
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

describe('toDeleteAccountResult', () => {
  test('deletedAt ISO → Instant, gracePeriodDays 포함', () => {
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
  test('linkedAt ISO → Instant', () => {
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
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0]?.provider).toBe('GOOGLE');
    expect(result.accounts[1]?.provider).toBe('KAKAO');
    expect(result.canUnlink).toBe(true);
  });

  test('빈 배열 → 빈 배열', () => {
    // Given
    const dto = { accounts: [], canUnlink: false };

    // When
    const result = toLinkedAccounts(dto);

    // Then
    expect(result.accounts).toEqual([]);
    expect(result.canUnlink).toBe(false);
  });
});
