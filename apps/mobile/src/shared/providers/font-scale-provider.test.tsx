import { createMemoryObservableSyncStorage } from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { FontScaleProvider, useFontScale } from './font-scale-provider';

const createWrapper =
  (syncStorage = createMemoryObservableSyncStorage()) =>
  ({ children }: PropsWithChildren) => (
    <FontScaleProvider syncStorage={syncStorage}>{children}</FontScaleProvider>
  );

describe('useFontScale', () => {
  it('저장된 값이 없으면 medium으로 초기화된다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();

    // When
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // Then
    expect(result.current.fontScale).toBe('medium');
  });

  it('저장된 값으로 초기화된다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_font_scale', 'large');

    // When
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // Then
    expect(result.current.fontScale).toBe('large');
  });

  it('setFontScale 호출 시 상태와 스토리지를 업데이트한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // When
    await act(() => {
      result.current.setFontScale('xlarge');
    });

    // Then
    expect(result.current.fontScale).toBe('xlarge');
    expect(storage.get('aido_font_scale')).toBe('xlarge');
  });
});

describe('resolveSize', () => {
  it('medium이면 원래 사이즈를 그대로 반환한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_font_scale', 'medium');
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // When
    const sizes = [
      result.current.resolveSize('b3'),
      result.current.resolveSize('h1'),
      result.current.resolveSize('e2'),
    ];

    // Then
    expect(sizes).toEqual(['b3', 'h1', 'e2']);
  });

  it('large이면 한 단계 위로 리매핑한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_font_scale', 'large');
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // When
    const sizes = [
      result.current.resolveSize('b3'),
      result.current.resolveSize('b2'),
      result.current.resolveSize('e2'),
    ];

    // Then
    expect(sizes).toEqual(['b2', 'b1', 'e1']);
  });

  it('small이면 한 단계 아래로 리매핑한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_font_scale', 'small');
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // When
    const sizes = [
      result.current.resolveSize('b2'),
      result.current.resolveSize('b1'),
      result.current.resolveSize('h1'),
    ];

    // Then
    expect(sizes).toEqual(['b3', 'b2', 't1']);
  });

  it('t2에서 t1로 6px 점프하지 않도록 large에서도 t2를 유지한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_font_scale', 'large');
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // When
    const size = result.current.resolveSize('t2');

    // Then
    // large에서 t2는 t2 유지 (t1으로 올라가지 않음)
    expect(size).toBe('t2');
  });

  it('xlarge이면 두 단계 위로 리매핑한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_font_scale', 'xlarge');
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // When
    const sizes = [
      result.current.resolveSize('b3'),
      result.current.resolveSize('b4'),
      result.current.resolveSize('e1'),
    ];

    // Then
    expect(sizes).toEqual(['b1', 'b2', 'b3']);
  });

  it('xsmall이면 두 단계 아래로 리매핑한다', async () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_font_scale', 'xsmall');
    const { result } = await renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // When
    const sizes = [
      result.current.resolveSize('b2'),
      result.current.resolveSize('b1'),
      result.current.resolveSize('e1'),
    ];

    // Then
    expect(sizes).toEqual(['b4', 'b3', 'e2']);
  });
});
