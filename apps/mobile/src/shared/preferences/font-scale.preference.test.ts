import { createMockSyncStorage } from '@src/shared/__tests__';

import { isFontScale, readFontScale, writeFontScale } from './font-scale.preference';

describe('isFontScale', () => {
  it.each(['xsmall', 'small', 'medium', 'large', 'xlarge'] as const)(
    '%s는 유효한 FontScale이다',
    (value) => {
      expect(isFontScale(value)).toBe(true);
    },
  );

  it.each([undefined, null, '', 'invalid', 123, true])(
    '%s는 유효한 FontScale이 아니다',
    (value) => {
      expect(isFontScale(value)).toBe(false);
    },
  );
});

describe('readFontScale', () => {
  it('저장된 값이 없으면 medium을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    const result = readFontScale(storage);

    // Then
    expect(result).toBe('medium');
  });

  it.each(['xsmall', 'small', 'medium', 'large', 'xlarge'] as const)(
    '%s가 저장되어 있으면 %s를 반환한다',
    (value) => {
      // Given
      const storage = createMockSyncStorage();
      storage.getString.mockReturnValue(value);

      // When
      const result = readFontScale(storage);

      // Then
      expect(result).toBe(value);
    },
  );

  it('유효하지 않은 값이 저장되어 있으면 medium을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('invalid');

    // When
    const result = readFontScale(storage);

    // Then
    expect(result).toBe('medium');
  });
});

describe('writeFontScale', () => {
  it('올바른 key와 value로 storage.set을 호출한다', () => {
    // Given
    const storage = createMockSyncStorage();

    // When
    writeFontScale(storage, 'xlarge');

    // Then
    expect(storage.set).toHaveBeenCalledWith('aido_font_scale', 'xlarge');
  });
});
