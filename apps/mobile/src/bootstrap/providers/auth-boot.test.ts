import { createMockStorage, createMockSyncStorage } from '@src/shared/__tests__';
import {
  clearStaleTokensOnFreshInstall,
  FIRST_RUN_FLAG,
  resolveInitialAuthStatus,
} from './auth-boot';

describe('앱 부팅 인증 처리 — 재설치 잔존 토큰 가드', () => {
  let secureStorage: ReturnType<typeof createMockStorage>;
  let flags: ReturnType<typeof createMockSyncStorage>;

  beforeEach(() => {
    secureStorage = createMockStorage();
    flags = createMockSyncStorage();
  });

  it('재설치: 첫 실행(플래그 없음)인데 키체인에 이전 토큰이 남아있으면 → 토큰을 제거하고 미인증으로 시작한다', async () => {
    // Given — iOS 키체인은 앱 삭제 후에도 잔존, MMKV 플래그는 소멸(첫 실행)
    flags.getString.mockReturnValue(undefined);
    secureStorage.get.mockResolvedValue('stale-access-token');

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags);

    // Then — 잔존 토큰 제거 + 플래그 심기 + 미인증 시작(즉시 로그아웃 루프 방지)
    expect(secureStorage.remove).toHaveBeenCalledWith('accessToken');
    expect(secureStorage.remove).toHaveBeenCalledWith('refreshToken');
    expect(flags.set).toHaveBeenCalledWith(FIRST_RUN_FLAG, '1');
    expect(status).toBe('unauthenticated');
  });

  it('정상 재실행: 플래그가 있으면 토큰을 보존하고 인증 상태를 유지한다', async () => {
    // Given — 이미 실행된 적 있는 설치(플래그 존재) + 유효 토큰
    flags.getString.mockReturnValue('1');
    secureStorage.get.mockResolvedValue('valid-access-token');

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags);

    // Then — 토큰을 건드리지 않고 인증 유지
    expect(secureStorage.remove).not.toHaveBeenCalled();
    expect(status).toBe('authenticated');
  });

  it('신규 설치: 플래그도 토큰도 없으면 플래그만 심고 미인증으로 시작한다', async () => {
    // Given
    flags.getString.mockReturnValue(undefined);
    secureStorage.get.mockResolvedValue(null);

    // When
    const status = await resolveInitialAuthStatus(secureStorage, flags);

    // Then
    expect(flags.set).toHaveBeenCalledWith(FIRST_RUN_FLAG, '1');
    expect(status).toBe('unauthenticated');
  });

  it('clearStaleTokensOnFreshInstall: 플래그가 있으면 아무것도 지우지 않고 false를 반환한다', async () => {
    // Given
    flags.getString.mockReturnValue('1');

    // When
    const cleared = await clearStaleTokensOnFreshInstall(secureStorage, flags);

    // Then
    expect(cleared).toBe(false);
    expect(secureStorage.remove).not.toHaveBeenCalled();
    expect(flags.set).not.toHaveBeenCalled();
  });
});
