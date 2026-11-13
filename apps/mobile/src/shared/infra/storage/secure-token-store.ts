import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { STORAGE_KEYS } from '@src/shared/storage/secure-storage-keys';
import { Mutex } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

type UnsyncedChange = { kind: 'saved'; tokens: AuthTokenPair } | { kind: 'cleared' };

export function createSecureTokenStore(storage: KeyValueStorage): TokenStore {
  // 서버가 이미 회전한 토큰이라 쓰기가 늦거나 실패해도 키체인의 지난 토큰보다 이것을 읽는다(지난 refresh 토큰은 grace 뒤 SESSION_0704)
  let latestChange: UnsyncedChange | null = null;
  // 늦게 끝난 앞 작업이 뒤 세션을 덮거나 지우면 다음 실행이 지난 세션을 읽거나 로그아웃된다
  const keychainLock = new Mutex();

  const forget = (change: UnsyncedChange) => {
    if (latestChange === change) {
      latestChange = null;
    }
  };

  const readToken = async (key: string, pick: (tokens: AuthTokenPair) => string) => {
    if (latestChange == null) {
      return storage.get(key, z.string());
    }
    return match(latestChange)
      .with({ kind: 'saved' }, ({ tokens }) => pick(tokens))
      .with({ kind: 'cleared' }, () => null)
      .exhaustive();
  };

  const runInOrder = async (task: () => Promise<void>) => {
    await keychainLock.acquire();
    try {
      await task();
    } finally {
      keychainLock.release();
    }
  };

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
    getAccessToken: () => readToken(STORAGE_KEYS.ACCESS_TOKEN, (tokens) => tokens.accessToken),

    getRefreshToken: () => readToken(STORAGE_KEYS.REFRESH_TOKEN, (tokens) => tokens.refreshToken),

    save: async (tokens) => {
      const change: UnsyncedChange = { kind: 'saved', tokens };
      latestChange = change;
      await runInOrder(() => writeTokens(tokens));
      forget(change);
    },

    clear: async () => {
      const change: UnsyncedChange = { kind: 'cleared' };
      latestChange = change;
      try {
        await runInOrder(removeTokens);
      } finally {
        forget(change);
      }
    },
  };
}
