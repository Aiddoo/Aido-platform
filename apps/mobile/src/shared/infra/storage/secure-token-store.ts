import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { STORAGE_KEYS } from '@src/shared/storage/secure-storage-keys';
import { z } from 'zod';

export function createSecureTokenStore(storage: KeyValueStorage): TokenStore {
  // 서버가 이미 회전한 토큰이라 키체인 쓰기가 늦거나 실패해도 이 실행은 키체인의 지난 토큰보다 이것을 쓴다(지난 refresh 토큰은 grace 뒤 SESSION_0704)
  let unsavedTokens: AuthTokenPair | null = null;
  let pendingWrites: Promise<unknown> = Promise.resolve();
  let clearCount = 0;

  /** 한쪽 삭제가 실패해도 다른 쪽 삭제를 시도한다 — 반쪽 세션을 남기지 않는다. */
  const removeTokens = async (): Promise<void> => {
    const results = await Promise.allSettled([
      storage.remove(STORAGE_KEYS.REFRESH_TOKEN),
      storage.remove(STORAGE_KEYS.ACCESS_TOKEN),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason;
      }
    }
  };

  /** 두 키 쓰기는 원자적이지 않아 리프레시 토큰을 먼저 쓴다. 리프레시만 남으면 다음 401에서 회복하지만 액세스만 남으면 15분 뒤 세션이 죽는다 */
  const writeTokens = async ({ accessToken, refreshToken }: AuthTokenPair): Promise<void> => {
    await storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    await storage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  };

  return {
    getAccessToken: async () =>
      unsavedTokens?.accessToken ?? storage.get(STORAGE_KEYS.ACCESS_TOKEN, z.string()),

    getRefreshToken: async () =>
      unsavedTokens?.refreshToken ?? storage.get(STORAGE_KEYS.REFRESH_TOKEN, z.string()),

    save: async (tokens) => {
      unsavedTokens = tokens;
      const clearCountAtSave = clearCount;
      const isSessionEnded = () => clearCount !== clearCountAtSave;
      // 쓰기는 부른 차례대로 한다. 늦게 끝난 앞 쓰기가 뒤에 받은 토큰을 덮으면 다음 실행이 지난 refresh 토큰을 읽는다
      const written = pendingWrites.then(async () => {
        if (isSessionEnded()) {
          return;
        }
        await writeTokens(tokens);
        // 쓰는 사이 세션이 끝났다. 늦게 쓴 토큰이 남으면 로그아웃한 세션이 다음 실행에 되살아난다. 차례 안에서 지워 뒤에 저장한 새 세션은 건드리지 않는다
        if (isSessionEnded()) {
          await removeTokens();
        }
      });
      pendingWrites = written.catch(() => undefined);
      await written;

      if (unsavedTokens === tokens) {
        unsavedTokens = null;
      }
    },

    clear: async () => {
      unsavedTokens = null;
      clearCount += 1;
      await removeTokens();
    },
  };
}
