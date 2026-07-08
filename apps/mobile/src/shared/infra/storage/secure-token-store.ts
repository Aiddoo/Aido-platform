import type { Storage } from '@src/core/ports/storage';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { STORAGE_KEYS } from '@src/shared/constants/storage-keys.constant';

/**
 * SecureStore(키체인) 기반 TokenStore.
 *
 * 앱에서 `STORAGE_KEYS`의 토큰 키를 참조하는 유일한 모듈이다.
 */
export const createSecureTokenStore = (storage: Storage): TokenStore => ({
  readAccessToken: () => storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN),

  readRefreshToken: () => storage.get<string>(STORAGE_KEYS.REFRESH_TOKEN),

  /**
   * 리프레시 토큰을 먼저 쓴다.
   *
   * 두 키 쓰기는 원자적이지 않다. 부분 실패가 나더라도 세션의 근거(리프레시 토큰)가
   * 남는 쪽으로 기울인다 — 액세스 토큰만 남으면 15분 뒤 세션이 죽지만,
   * 리프레시 토큰만 남으면 다음 401에서 조용히 회복한다.
   */
  async save({ accessToken, refreshToken }: AuthTokenPair): Promise<void> {
    await storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    await storage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  },

  /** 한쪽 삭제가 실패해도 다른 쪽 삭제를 시도한다 — 반쪽 세션을 남기지 않는다. */
  async clear(): Promise<void> {
    const results = await Promise.allSettled([
      storage.remove(STORAGE_KEYS.REFRESH_TOKEN),
      storage.remove(STORAGE_KEYS.ACCESS_TOKEN),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason;
      }
    }
  },
});
