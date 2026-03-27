import { createMockSyncStorage } from '@src/shared/__tests__';
import { readFontScale, writeFontScale } from './font-scale.preference';

describe('readFontScale', () => {
  it('저장된 값이 없으면 normal을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    const result = readFontScale(storage);

    // Then
    expect(result).toBe('normal');
  });

  it('small이 저장되어 있으면 small을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('small');

    // When
    const result = readFontScale(storage);

    // Then
    expect(result).toBe('small');
  });

  it('normal이 저장되어 있으면 normal을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('normal');

    // When
    const result = readFontScale(storage);

    // Then
    expect(result).toBe('normal');
  });

  it('large가 저장되어 있으면 large를 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('large');

    // When
    const result = readFontScale(storage);

    // Then
    expect(result).toBe('large');
  });

  it('유효하지 않은 값이 저장되어 있으면 normal을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('invalid');

    // When
    const result = readFontScale(storage);

    // Then
    expect(result).toBe('normal');
  });
});

describe('writeFontScale', () => {
  it('올바른 key와 value로 storage.set을 호출한다', () => {
    // Given
    const storage = createMockSyncStorage();

    // When
    writeFontScale(storage, 'large');

    // Then
    expect(storage.set).toHaveBeenCalledWith('aido_font_scale', 'large');
  });
});
