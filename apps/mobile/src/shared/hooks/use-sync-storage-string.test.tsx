import { createMemoryObservableSyncStorage } from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';

import { useSyncStorageString } from './use-sync-storage-string';

describe('useSyncStorageString', () => {
  it('저장된 값이 없으면 undefined를 준다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();

    // When
    const { result } = await renderHook(() => useSyncStorageString(storage, 'key'));

    // Then
    expect(result.current[0]).toBeUndefined();
  });

  it('값을 쓰면 저장소에 남기고 바로 다시 그린다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const { result } = await renderHook(() => useSyncStorageString(storage, 'key'));

    // When
    await act(() => result.current[1]('dark'));

    // Then
    expect(result.current[0]).toBe('dark');
    expect(storage.get('key')).toBe('dark');
  });

  it('undefined를 쓰면 키를 지운다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('key', 'dark');
    const { result } = await renderHook(() => useSyncStorageString(storage, 'key'));

    // When
    await act(() => result.current[1](undefined));

    // Then
    expect(result.current[0]).toBeUndefined();
    expect(storage.get('key')).toBeUndefined();
  });

  it('다른 곳에서 같은 키를 바꿔도 따라간다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const { result } = await renderHook(() => useSyncStorageString(storage, 'key'));

    // When
    await act(() => storage.set('key', 'light'));

    // Then
    expect(result.current[0]).toBe('light');
  });

  it('키가 바뀌면 새 키의 값을 읽는다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('user-a', 'seen');
    const { result, rerender } = await renderHook(
      ({ storageKey }: { storageKey: string }) => useSyncStorageString(storage, storageKey),
      { initialProps: { storageKey: 'user-a' } },
    );

    // When
    await rerender({ storageKey: 'user-b' });

    // Then
    expect(result.current[0]).toBeUndefined();
  });
});
