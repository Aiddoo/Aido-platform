import { createMemoryTokenStore } from '@src/testing/core';

import { createSessionEpoch, withSessionEpoch } from './session-epoch';

describe('withSessionEpoch', () => {
  it('토큰을 지우면 세대가 오른다', async () => {
    // Given
    const epoch = createSessionEpoch();
    const store = withSessionEpoch(createMemoryTokenStore(), epoch);

    // When
    await store.clear();

    // Then
    expect(epoch.current()).toBe(1);
  });

  it('토큰을 저장해도 세대가 오르지 않는다', async () => {
    // Given
    const epoch = createSessionEpoch();
    const store = withSessionEpoch(createMemoryTokenStore(), epoch);

    // When
    await store.save({ accessToken: 'a', refreshToken: 'r' });

    // Then
    expect(epoch.current()).toBe(0);
    await expect(store.getRefreshToken()).resolves.toBe('r');
  });

  it('삭제가 실패해도 세대는 오른다', async () => {
    // Given
    const epoch = createSessionEpoch();
    const store = withSessionEpoch(
      {
        ...createMemoryTokenStore(),
        clear: async () => {
          throw new Error('keychain write failed');
        },
      },
      epoch,
    );

    // When
    await expect(store.clear()).rejects.toThrow('keychain write failed');

    // Then
    expect(epoch.current()).toBe(1);
  });
});
