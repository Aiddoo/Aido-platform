import { createMockSyncStorage } from '@src/shared/__tests__';
import { readThemeMode, writeThemeMode } from './theme-mode.preference';

describe('readThemeMode', () => {
  it('저장된 값이 없으면 system을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    const result = readThemeMode(storage);

    // Then
    expect(result).toBe('system');
  });

  it('light가 저장되어 있으면 light를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('light');

    // When
    const result = readThemeMode(storage);

    // Then
    expect(result).toBe('light');
  });

  it('dark가 저장되어 있으면 dark를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('dark');

    // When
    const result = readThemeMode(storage);

    // Then
    expect(result).toBe('dark');
  });

  it('system이 저장되어 있으면 system을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('system');

    // When
    const result = readThemeMode(storage);

    // Then
    expect(result).toBe('system');
  });

  it('유효하지 않은 값이 저장되어 있으면 system을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('invalid');

    // When
    const result = readThemeMode(storage);

    // Then
    expect(result).toBe('system');
  });
});

describe('writeThemeMode', () => {
  it('올바른 key와 value로 storage.set을 호출한다', () => {
    // Given
    const storage = createMockSyncStorage();

    // When
    writeThemeMode(storage, 'dark');

    // Then
    expect(storage.set).toHaveBeenCalledWith('aido_theme_mode', 'dark');
  });
});
