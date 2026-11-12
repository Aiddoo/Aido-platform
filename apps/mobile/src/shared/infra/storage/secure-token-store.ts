import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { STORAGE_KEYS } from '@src/shared/storage/secure-storage-keys';
import { z } from 'zod';

export function createSecureTokenStore(storage: KeyValueStorage): TokenStore {
  return {
    getAccessToken: () => storage.get(STORAGE_KEYS.ACCESS_TOKEN, z.string()),

    getRefreshToken: () => storage.get(STORAGE_KEYS.REFRESH_TOKEN, z.string()),

    /** 두 키 쓰기는 원자적이지 않아 리프레시 토큰을 먼저 쓴다. 리프레시만 남으면 다음 401에서 회복하지만 액세스만 남으면 15분 뒤 세션이 죽는다 */
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
  };
}
