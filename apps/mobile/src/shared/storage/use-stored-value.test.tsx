import {
  createMemoryObservableSyncStorage,
  createMemorySyncStorage,
  renderUiHook,
} from '@src/shared/__tests__';
import { act } from '@testing-library/react-native';
import { z } from 'zod';

import { defineStoredValue, storedJsonSchema } from './define-stored-value';
import { useStoredValue } from './use-stored-value';

const dismissalsStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_test_dismissals_v1:${accountId}`,
  schema: storedJsonSchema(z.record(z.string(), z.iso.date())),
  fallback: {},
});

const languageStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_test_language_v1:${accountId}`,
  area: 'account',
  schema: z.enum(['ko', 'en']),
  fallback: null,
});

describe('useStoredValue', () => {
  it('원문이 그대로면 다시 그려도 같은 값(참조)을 준다', async () => {
    // Given
    const syncStorage = createMemoryObservableSyncStorage();
    syncStorage.set('aido_test_dismissals_v1:account-1', '{"AI_PARSE":"2026-11-11"}');
    const { result, rerender } = await renderUiHook(
      () => useStoredValue(dismissalsStoredValue, 'account-1'),
      { di: { syncStorage } },
    );
    const [first] = result.current;

    // When
    await rerender({});

    // Then
    expect(result.current[0]).toBe(first);
    expect(first).toEqual({ AI_PARSE: '2026-11-11' });
  });

  it('다른 곳에서 같은 키를 쓰면 구독한 훅이 새 값으로 다시 그린다', async () => {
    // Given
    const syncStorage = createMemoryObservableSyncStorage();
    const { result } = await renderUiHook(
      () => useStoredValue(dismissalsStoredValue, 'account-1'),
      { di: { syncStorage } },
    );

    // When
    await act(() => syncStorage.set('aido_test_dismissals_v1:account-1', '{"NUDGE":"2026-11-11"}'));

    // Then
    expect(result.current[0]).toEqual({ NUDGE: '2026-11-11' });
  });

  it('범위가 없으면 fallback이고 세터는 아무것도 쓰지 않는다', async () => {
    // Given
    const syncStorage = createMemoryObservableSyncStorage();
    const { result } = await renderUiHook(() => useStoredValue(dismissalsStoredValue, undefined), {
      di: { syncStorage },
    });

    // When
    await act(() => result.current[1]({ AI_PARSE: '2026-11-11' }));

    // Then
    expect(result.current[0]).toEqual({});
    expect(syncStorage.keys()).toEqual([]);
    expect(syncStorage.getListenerCount()).toBe(0);
  });

  it('계정 범위 값은 로그아웃 때 비우는 암호화 저장소에서 읽고 쓴다', async () => {
    // Given
    const syncStorage = createMemoryObservableSyncStorage();
    const draftStorage = createMemorySyncStorage();
    const { result } = await renderUiHook(() => useStoredValue(languageStoredValue, 'account-1'), {
      di: { syncStorage, draftStorage },
    });

    // When
    await act(() => result.current[1]('en'));

    // Then
    expect(result.current[0]).toBe('en');
    expect(draftStorage.get('aido_test_language_v1:account-1')).toBe('en');
    expect(syncStorage.keys()).toEqual([]);
  });
});
