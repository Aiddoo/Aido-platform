import { createMemoryObservableSyncStorage } from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Uniwind } from 'uniwind';

import { ThemeProvider, useTheme } from './theme-provider';

const createWrapper =
  (syncStorage = createMemoryObservableSyncStorage()) =>
  ({ children }: PropsWithChildren) => (
    <ThemeProvider syncStorage={syncStorage}>{children}</ThemeProvider>
  );

describe('useTheme', () => {
  it('저장된 값이 없으면 system 모드로 시작한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();

    // When
    const { result } = await renderHook(() => useTheme(), { wrapper: createWrapper(storage) });

    // Then
    expect(result.current.mode).toBe('system');
  });

  it('저장된 모드로 시작해 그 테마를 적용한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_theme_mode', 'dark');
    const setTheme = jest.spyOn(Uniwind, 'setTheme');

    // When
    const { result } = await renderHook(() => useTheme(), { wrapper: createWrapper(storage) });

    // Then
    expect(result.current.mode).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('알 수 없는 저장 값은 system으로 본다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_theme_mode', 'sepia');

    // When
    const { result } = await renderHook(() => useTheme(), { wrapper: createWrapper(storage) });

    // Then
    expect(result.current.mode).toBe('system');
  });

  it('setMode를 부르면 화면 상태와 저장소 값이 함께 바뀐다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const { result } = await renderHook(() => useTheme(), { wrapper: createWrapper(storage) });

    // When
    await act(() => {
      result.current.setMode('light');
    });

    // Then
    expect(result.current.mode).toBe('light');
    expect(storage.get('aido_theme_mode')).toBe('light');
  });
});
