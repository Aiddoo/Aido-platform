import {
  createAuthTokensDto,
  createDeleteAccountDto,
  createRegisterDto,
} from '../__tests__/auth.fixtures';
import {
  toAuthTokens,
  toDeleteAccountResult,
  toLinkedAccount,
  toLinkedAccounts,
  toRegisterResult,
} from './auth.mapper';

describe('toAuthTokens', () => {
  it('name → userName, profileImage → userProfileImage 매핑', () => {
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

  it('accountRestored true → true 유지', () => {
    // Given
    const dto = createAuthTokensDto({ accountRestored: true });

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.accountRestored).toBe(true);
  });

  it('isNewUser가 없는 이메일 로그인 응답은 기존 로그인으로 본다', () => {
    // Given
    const dto = createAuthTokensDto();

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.isNewUser).toBe(false);
  });

  it('isNewUser true → true 유지', () => {
    // Given
    const dto = createAuthTokensDto({ isNewUser: true });

    // When
    const result = toAuthTokens(dto);

    // Then
    expect(result.isNewUser).toBe(true);
  });
});

describe('toRegisterResult', () => {
  it('인증 메일을 보내지 못했다는 응답을 그대로 옮긴다', () => {
    // Given
    const dto = createRegisterDto({ emailSent: false });

    // When
    const result = toRegisterResult(dto);

    // Then
    expect(result.isEmailSent).toBe(false);
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

describe('toLinkedAccounts', () => {
  it('빈 배열 → 빈 배열', () => {
    // Given
    const dto = { accounts: [], canUnlink: false };

    // When
    const result = toLinkedAccounts(dto);

    // Then
    expect(result.accounts).toEqual([]);
    expect(result.canUnlink).toBe(false);
  });
});
