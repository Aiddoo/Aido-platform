import { createMockSyncStorage } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { FontScaleProvider, useFontScale } from './font-scale-provider';

const createWrapper =
  (syncStorage = createMockSyncStorage()) =>
  ({ children }: PropsWithChildren) => (
    <FontScaleProvider syncStorage={syncStorage}>{children}</FontScaleProvider>
  );

describe('useFontScale', () => {
  it('FontScaleProvider 없이 사용하면 에러를 던진다', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useFontScale())).toThrow(
      'useFontScale must be used within FontScaleProvider',
    );
  });

  it('저장된 값이 없으면 medium으로 초기화된다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    expect(result.current.fontScale).toBe('medium');
  });

  it('저장된 값으로 초기화된다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('large');

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    expect(result.current.fontScale).toBe('large');
  });

  it('setFontScale 호출 시 상태와 스토리지를 업데이트한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    act(() => {
      result.current.setFontScale('xlarge');
    });

    expect(result.current.fontScale).toBe('xlarge');
    expect(storage.set).toHaveBeenCalledWith('aido_font_scale', 'xlarge');
  });
});

describe('resolveSize', () => {
  it('medium이면 원래 사이즈를 그대로 반환한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('medium');

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    expect(result.current.resolveSize('b3')).toBe('b3');
    expect(result.current.resolveSize('h1')).toBe('h1');
    expect(result.current.resolveSize('e2')).toBe('e2');
  });

  it('large이면 한 단계 위로 리매핑한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('large');

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    expect(result.current.resolveSize('b3')).toBe('b2');
    expect(result.current.resolveSize('b2')).toBe('b1');
    expect(result.current.resolveSize('e2')).toBe('e1');
  });

  it('small이면 한 단계 아래로 리매핑한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('small');

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    expect(result.current.resolveSize('b2')).toBe('b3');
    expect(result.current.resolveSize('b1')).toBe('b2');
    expect(result.current.resolveSize('h1')).toBe('t1');
  });

  it('t2↔t1 간 6px 점프를 방지한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('large');

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    // large에서 t2는 t2 유지 (t1으로 올라가지 않음)
    expect(result.current.resolveSize('t2')).toBe('t2');
  });

  it('xlarge이면 두 단계 위로 리매핑한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('xlarge');

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    expect(result.current.resolveSize('b3')).toBe('b1');
    expect(result.current.resolveSize('b4')).toBe('b2');
    expect(result.current.resolveSize('e1')).toBe('b3');
  });

  it('xsmall이면 두 단계 아래로 리매핑한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('xsmall');

    const { result } = renderHook(() => useFontScale(), { wrapper: createWrapper(storage) });

    expect(result.current.resolveSize('b2')).toBe('b4');
    expect(result.current.resolveSize('b1')).toBe('b3');
    expect(result.current.resolveSize('e1')).toBe('e2');
  });
});
