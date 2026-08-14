import { createMockSyncStorage } from '@src/shared/__tests__';
import { i18n } from '@src/shared/i18n';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LanguageProvider, useLanguage } from './language-provider';

const createWrapper =
  (syncStorage = createMockSyncStorage(), deviceLanguage: () => string | null = () => 'ko') =>
  ({ children }: PropsWithChildren) => (
    <LanguageProvider syncStorage={syncStorage} deviceLanguage={deviceLanguage}>
      {children}
    </LanguageProvider>
  );

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('useLanguage', () => {
  it('LanguageProvider 없이 사용하면 기본값을 반환한다', async () => {
    const { result } = await renderHook(() => useLanguage());

    expect(result.current.languageMode).toBe('system');
    expect(result.current.resolvedLanguage).toBe('ko');
  });

  it('저장된 값이 없으면 system 모드로 초기화된다', async () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    const { result } = await renderHook(() => useLanguage(), { wrapper: createWrapper(storage) });

    // Then
    expect(result.current.languageMode).toBe('system');
  });

  it('저장된 모드로 초기화된다', async () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('en');

    // When
    const { result } = await renderHook(() => useLanguage(), { wrapper: createWrapper(storage) });

    // Then
    expect(result.current.languageMode).toBe('en');
    expect(result.current.resolvedLanguage).toBe('en');
  });

  it('system 모드에서 기기 언어로 표시 언어를 해석한다', async () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('system');

    // When
    const { result } = await renderHook(() => useLanguage(), {
      wrapper: createWrapper(storage, () => 'en'),
    });

    // Then
    expect(result.current.resolvedLanguage).toBe('en');
  });

  it('setLanguageMode 호출 시 상태·스토리지·i18n 언어를 업데이트한다', async () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);
    const changeLanguageSpy = jest.spyOn(i18n, 'changeLanguage');

    const { result } = await renderHook(() => useLanguage(), { wrapper: createWrapper(storage) });

    // When
    await act(() => {
      result.current.setLanguageMode('en');
    });

    // Then
    expect(result.current.languageMode).toBe('en');
    expect(result.current.resolvedLanguage).toBe('en');
    expect(storage.set).toHaveBeenCalledWith('aido_language', 'en');
    expect(changeLanguageSpy).toHaveBeenCalledWith('en');
  });

  it('system 모드로 되돌리면 기기 언어 기준으로 i18n 언어를 변경한다', async () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('en');
    const changeLanguageSpy = jest.spyOn(i18n, 'changeLanguage');

    const { result } = await renderHook(() => useLanguage(), {
      wrapper: createWrapper(storage, () => 'ko'),
    });

    // When
    await act(() => {
      result.current.setLanguageMode('system');
    });

    // Then
    expect(result.current.resolvedLanguage).toBe('ko');
    expect(changeLanguageSpy).toHaveBeenCalledWith('ko');
  });
});
