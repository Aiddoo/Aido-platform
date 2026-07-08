import { createMockTokenStore } from '@src/shared/__tests__';
import { KeychainLockedError } from '@src/shared/errors';
import { resolveInitialAuthStatus } from './auth-boot';

describe('앱 부팅 인증 판정 — 클라이언트는 세션을 먼저 끊지 않는다', () => {
  let tokenStore: ReturnType<typeof createMockTokenStore>;

  beforeEach(() => {
    tokenStore = createMockTokenStore();
  });

  it('리프레시 토큰이 있으면 인증 상태로 시작한다', async () => {
    // Given
    tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');

    // When
    const status = await resolveInitialAuthStatus(tokenStore);

    // Then
    expect(status).toBe('authenticated');
  });

  it('리프레시 토큰이 없으면 미인증으로 시작한다', async () => {
    // Given
    tokenStore.readRefreshToken.mockResolvedValue(null);

    // When
    const status = await resolveInitialAuthStatus(tokenStore);

    // Then
    expect(status).toBe('unauthenticated');
  });

  it('기기 잠금으로 읽지 못하면 미인증이 아니라 locked로 판정을 미룬다', async () => {
    // Given — 기기 잠금 중 콜드 스타트(푸시·백그라운드 실행). iOS는 null이 아니라 throw한다.
    tokenStore.readRefreshToken.mockRejectedValue(
      new KeychainLockedError(new Error('User interaction is not allowed.')),
    );

    // When
    const status = await resolveInitialAuthStatus(tokenStore);

    // Then — locked를 미인증으로 확정하면 잠긴 키체인이 곧 로그아웃이 된다
    expect(status).toBe('locked');
  });

  it('잠금이 아닌 읽기 실패는 locked로 뭉개지 않고 그대로 던진다', async () => {
    // Given — 키체인 손상(Android DecryptException)·entitlement 오설정 등 영구 오류.
    // locked로 두면 재판정도 계속 실패해 앱이 조용히 무한 로딩에 갇힌다.
    tokenStore.readRefreshToken.mockRejectedValue(new Error('Could not decrypt the value'));

    // When & Then
    await expect(resolveInitialAuthStatus(tokenStore)).rejects.toThrow(
      'Could not decrypt the value',
    );
  });

  it('세션 존재 판단은 리프레시 토큰 기준이다 (액세스 토큰과 무관)', async () => {
    // Given
    tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');

    // When
    await resolveInitialAuthStatus(tokenStore);

    // Then — 액세스 토큰은 만료돼도 refresh로 재발급되므로 세션의 근거가 아니다
    expect(tokenStore.readRefreshToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.readAccessToken).not.toHaveBeenCalled();
  });

  describe('불변식: 부팅 경로는 토큰을 지우지 않고 네트워크를 타지 않는다', () => {
    it.each([
      ['업데이트 직후(토큰 있음)', async () => 'valid-refresh-token'],
      ['신규 설치(토큰 없음)', async () => null],
    ])('%s에도 토큰을 지우지 않는다', async (_case, read) => {
      // Given — 로컬 휴리스틱(첫 실행 플래그)으로 재설치를 추측하면 v1.4.0 사고가 재발한다
      tokenStore.readRefreshToken.mockImplementation(read);

      // When
      await resolveInitialAuthStatus(tokenStore);

      // Then
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('기기 잠금으로 읽지 못해도 토큰을 지우지 않는다', async () => {
      // Given
      tokenStore.readRefreshToken.mockRejectedValue(new KeychainLockedError(new Error('locked')));

      // When
      await resolveInitialAuthStatus(tokenStore);

      // Then
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('잠금이 아닌 읽기 실패로 던질 때도 토큰을 지우지 않는다', async () => {
      // Given — 폴백은 미인증 표시일 뿐. 원인이 해소되면 다음 실행에 회복되어야 한다.
      tokenStore.readRefreshToken.mockRejectedValue(new Error('Could not decrypt the value'));

      // When
      await expect(resolveInitialAuthStatus(tokenStore)).rejects.toThrow();

      // Then
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('토큰을 저장하지도 않는다 (부팅은 읽기 전용)', async () => {
      // Given
      tokenStore.readRefreshToken.mockResolvedValue('valid-refresh-token');

      // When
      await resolveInitialAuthStatus(tokenStore);

      // Then
      expect(tokenStore.save).not.toHaveBeenCalled();
    });
  });
});
