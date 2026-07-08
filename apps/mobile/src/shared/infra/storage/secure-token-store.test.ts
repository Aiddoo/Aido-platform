import { createMockStorage } from '@src/shared/__tests__';
import { STORAGE_KEYS } from '@src/shared/constants/storage-keys.constant';
import { createSecureTokenStore } from './secure-token-store';

describe('createSecureTokenStore', () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('액세스 토큰과 리프레시 토큰을 각자의 키에서 읽는다', async () => {
    // Given
    storage.get.mockImplementation(async (key: string) =>
      key === STORAGE_KEYS.ACCESS_TOKEN ? 'access' : 'refresh',
    );
    const tokenStore = createSecureTokenStore(storage);

    // When
    const accessToken = await tokenStore.readAccessToken();
    const refreshToken = await tokenStore.readRefreshToken();

    // Then
    expect(accessToken).toBe('access');
    expect(refreshToken).toBe('refresh');
  });

  it('읽기 실패는 null로 삼키지 않고 그대로 전파한다', async () => {
    // Given — "토큰이 없다"와 "지금 읽을 수 없다"를 혼동하면 살아있는 세션이 죽는다
    storage.get.mockRejectedValue(new Error('User interaction is not allowed.'));
    const tokenStore = createSecureTokenStore(storage);

    // When & Then
    await expect(tokenStore.readRefreshToken()).rejects.toThrow('User interaction is not allowed.');
  });

  it('저장 시 리프레시 토큰을 먼저 쓴다', async () => {
    // Given — 두 쓰기는 원자적이지 않다. 부분 실패 시 세션의 근거가 남는 쪽으로 기운다.
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

    // When & Then
    await expect(tokenStore.save({ accessToken: 'a', refreshToken: 'r' })).rejects.toThrow();
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN, 'r');
  });

  it('한쪽 삭제가 실패해도 다른 쪽 삭제를 시도한다', async () => {
    // Given — 반쪽 세션을 남기지 않는다
    storage.remove.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEYS.REFRESH_TOKEN) {
        throw new Error('remove failed');
      }
    });
    const tokenStore = createSecureTokenStore(storage);

    // When & Then
    await expect(tokenStore.clear()).rejects.toThrow('remove failed');
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
  });
});
