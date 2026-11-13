import { STORAGE_KEYS } from '@src/shared/storage/secure-storage-keys';
import { observeSettlement } from '@src/testing/core';
import { createMemoryKeyValueStorage } from '@src/testing/fakes/memory-key-value-storage.fake';

import { createSecureTokenStore } from './secure-token-store';

describe('createSecureTokenStore', () => {
  let storage: ReturnType<typeof createMemoryKeyValueStorage>;

  beforeEach(() => {
    storage = createMemoryKeyValueStorage();
  });

  it('액세스 토큰과 리프레시 토큰을 각자의 키에서 읽는다', async () => {
    // Given
    storage.get.mockImplementation(async (key: string) =>
      key === STORAGE_KEYS.ACCESS_TOKEN ? 'access' : 'refresh',
    );
    const tokenStore = createSecureTokenStore(storage);

    // When
    const accessToken = await tokenStore.getAccessToken();
    const refreshToken = await tokenStore.getRefreshToken();

    // Then
    expect(accessToken).toBe('access');
    expect(refreshToken).toBe('refresh');
  });

  it('출시된 설치의 키체인 항목을 가리키는 키 이름을 바꾸지 않는다', async () => {
    // Given
    const stored = new Map<string, unknown>();
    storage.set.mockImplementation(async (key, value) => {
      stored.set(key, value);
    });
    const tokenStore = createSecureTokenStore(storage);

    // When
    await tokenStore.save({ accessToken: 'a', refreshToken: 'r' });

    // Then
    expect(new Set(stored.keys())).toEqual(new Set(['accessToken', 'refreshToken']));
  });

  it('읽기 실패는 null로 삼키지 않고 그대로 전파한다', async () => {
    // Given
    // "토큰이 없다"와 "지금 읽을 수 없다"를 혼동하면 살아있는 세션이 죽는다
    storage.get.mockRejectedValue(new Error('User interaction is not allowed.'));
    const tokenStore = createSecureTokenStore(storage);

    // When
    const result = tokenStore.getRefreshToken();

    // Then
    await expect(result).rejects.toThrow('User interaction is not allowed.');
  });

  it('저장 시 리프레시 토큰을 먼저 쓴다', async () => {
    // Given
    // 두 쓰기는 원자적이지 않다. 부분 실패 시 세션의 근거가 남는 쪽으로 기운다.
    const writtenKeys: string[] = [];
    storage.set.mockImplementation(async (key: string) => {
      writtenKeys.push(key);
    });
    const tokenStore = createSecureTokenStore(storage);

    // When
    await tokenStore.save({ accessToken: 'a', refreshToken: 'r' });

    // Then
    expect(writtenKeys).toEqual([STORAGE_KEYS.REFRESH_TOKEN, STORAGE_KEYS.ACCESS_TOKEN]);
  });

  it('액세스 토큰 저장이 실패해도 리프레시 토큰은 이미 저장되어 있다', async () => {
    // Given
    storage.set.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.ACCESS_TOKEN) {
        throw new Error('keychain write failed');
      }
    });
    const tokenStore = createSecureTokenStore(storage);

    // When
    const result = tokenStore.save({ accessToken: 'a', refreshToken: 'r' });

    // Then
    await expect(result).rejects.toThrow('keychain write failed');
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN, 'r');
  });

  describe('키체인 쓰기가 늦거나 실패할 때', () => {
    /** 키체인 작업을 붙잡아 두고 테스트가 끝낸 것만 반영한다 */
    function holdWrites({ holdsRemoves = false }: { holdsRemoves?: boolean } = {}) {
      const stored = new Map<string, unknown>();
      const held: Array<{ finish: () => void }> = [];
      const hold = async (apply: () => void) => {
        const operation = Promise.withResolvers<void>();
        held.push({ finish: operation.resolve });
        await operation.promise;
        apply();
      };
      storage.set.mockImplementation((key, value) => hold(() => stored.set(key, value)));
      storage.get.mockImplementation(async (key: string) => stored.get(key) ?? null);
      storage.remove.mockImplementation(async (key: string) => {
        if (holdsRemoves) {
          await hold(() => stored.delete(key));
          return;
        }
        stored.delete(key);
      });
      // 다음 키체인 작업이 잠금을 넘겨받아 불릴 때까지 기다린다
      const settle = async () => {
        for (let turn = 0; turn < 20; turn += 1) {
          await Promise.resolve();
        }
      };
      const finishNext = async () => {
        await settle();
        held.shift()?.finish();
      };
      const finishLast = async () => {
        await settle();
        held.pop()?.finish();
      };
      return { stored, finishNext, finishLast };
    }

    it('쓰기가 끝나기 전에도 다음 읽기는 방금 받은 토큰을 돌려준다', async () => {
      // Given
      storage.get.mockResolvedValue('old');
      storage.set.mockReturnValue(Promise.withResolvers<void>().promise);
      const tokenStore = createSecureTokenStore(storage);

      // When
      const saving = observeSettlement(
        tokenStore.save({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
      );

      // Then
      await expect(tokenStore.getAccessToken()).resolves.toBe('access-2');
      await expect(tokenStore.getRefreshToken()).resolves.toBe('refresh-2');
      expect(saving.current.status).toBe('pending');
    });

    it('쓰기가 실패해도 이 실행은 방금 받은 토큰을 읽고 save는 실패를 알린다', async () => {
      // Given
      // 서버는 이미 회전했다. 회전 전 refresh 토큰으로 다시 갱신하면 grace 뒤 재사용(SESSION_0704)이다
      storage.get.mockResolvedValue('old');
      storage.set.mockRejectedValue(new Error('keychain write failed'));
      const tokenStore = createSecureTokenStore(storage);

      // When
      const saved = tokenStore.save({ accessToken: 'access-2', refreshToken: 'refresh-2' });

      // Then
      await expect(saved).rejects.toThrow('keychain write failed');
      await expect(tokenStore.getRefreshToken()).resolves.toBe('refresh-2');
    });

    it('늦게 끝난 앞 쓰기가 뒤에 받은 토큰을 덮지 않는다', async () => {
      // Given
      const { stored, finishNext, finishLast } = holdWrites();
      const tokenStore = createSecureTokenStore(storage);
      const first = tokenStore.save({ accessToken: 'access-1', refreshToken: 'refresh-1' });
      const second = tokenStore.save({ accessToken: 'access-2', refreshToken: 'refresh-2' });

      // When
      // 뒤 쓰기가 먼저 끝나고 앞 쓰기가 나중에 끝나는 키체인
      for (let write = 0; write < 4; write += 1) {
        await finishLast();
      }
      for (let write = 0; write < 4; write += 1) {
        await finishNext();
      }
      await Promise.all([first, second]);

      // Then
      expect(stored.get(STORAGE_KEYS.REFRESH_TOKEN)).toBe('refresh-2');
      expect(stored.get(STORAGE_KEYS.ACCESS_TOKEN)).toBe('access-2');
    });

    it('쓰는 도중 지우면 늦게 끝난 쓰기로 토큰을 되살리지 않는다', async () => {
      // Given
      const { stored, finishNext } = holdWrites();
      const tokenStore = createSecureTokenStore(storage);
      const saved = tokenStore.save({ accessToken: 'access-2', refreshToken: 'refresh-2' });

      // When
      const cleared = tokenStore.clear();
      const readWhileClearing = await tokenStore.getRefreshToken();
      for (let operation = 0; operation < 4; operation += 1) {
        await finishNext();
      }
      await Promise.all([saved, cleared]);

      // Then
      expect(readWhileClearing).toBeNull();
      expect(stored.size).toBe(0);
      await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
    });

    it('지운 직후 저장한 새 세션은 앞 삭제가 늦게 끝나도 지워지지 않는다', async () => {
      // Given
      const { stored, finishLast } = holdWrites({ holdsRemoves: true });
      const tokenStore = createSecureTokenStore(storage);
      const cleared = tokenStore.clear();

      // When
      // 나중에 부른 키체인 작업이 먼저 끝나는 키체인
      const saved = tokenStore.save({ accessToken: 'access-2', refreshToken: 'refresh-2' });
      for (let operation = 0; operation < 8; operation += 1) {
        await finishLast();
      }
      await Promise.all([cleared, saved]);

      // Then
      expect(stored.get(STORAGE_KEYS.REFRESH_TOKEN)).toBe('refresh-2');
      expect(stored.get(STORAGE_KEYS.ACCESS_TOKEN)).toBe('access-2');
    });

    it('쓰는 도중 로그아웃하고 다시 로그인한 세션은 앞 세션 정리로 지워지지 않는다', async () => {
      // Given
      const { stored, finishLast } = holdWrites({ holdsRemoves: true });
      const tokenStore = createSecureTokenStore(storage);
      const rotated = tokenStore.save({ accessToken: 'access-a', refreshToken: 'refresh-a' });
      const loggedOut = tokenStore.clear();

      // When
      const signedIn = tokenStore.save({ accessToken: 'access-b', refreshToken: 'refresh-b' });
      for (let operation = 0; operation < 12; operation += 1) {
        await finishLast();
      }
      await Promise.all([rotated, loggedOut, signedIn]);

      // Then
      expect(stored.get(STORAGE_KEYS.REFRESH_TOKEN)).toBe('refresh-b');
      expect(stored.get(STORAGE_KEYS.ACCESS_TOKEN)).toBe('access-b');
      await expect(tokenStore.getRefreshToken()).resolves.toBe('refresh-b');
    });
  });

  it('한쪽 삭제가 실패해도 다른 쪽 삭제를 시도한다', async () => {
    // Given
    // 반쪽 세션을 남기지 않는다
    storage.remove.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.REFRESH_TOKEN) {
        throw new Error('remove failed');
      }
    });
    const tokenStore = createSecureTokenStore(storage);

    // When
    const result = tokenStore.clear();

    // Then
    await expect(result).rejects.toThrow('remove failed');
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
  });
});
