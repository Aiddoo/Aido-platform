import { createMockSyncStorage } from '@src/shared/__tests__';

import {
  isLanguageMode,
  readLanguageMode,
  resolveLanguage,
  writeLanguageMode,
} from './language.preference';

describe('isLanguageMode', () => {
  it.each(['system', 'ko', 'en'] as const)('%s는 유효한 LanguageMode이다', (value) => {
    expect(isLanguageMode(value)).toBe(true);
  });

  it.each([undefined, null, '', 'invalid', 'ja', 123, true])(
    '%s는 유효한 LanguageMode가 아니다',
    (value) => {
      expect(isLanguageMode(value)).toBe(false);
    },
  );
});

describe('readLanguageMode', () => {
  it('저장된 값이 없으면 system을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);

    // When
    const result = readLanguageMode(storage);

    // Then
    expect(result).toBe('system');
  });

  it.each(['system', 'ko', 'en'] as const)('%s가 저장되어 있으면 %s를 반환한다', (value) => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(value);

    // When
    const result = readLanguageMode(storage);

    // Then
    expect(result).toBe(value);
  });

  it('유효하지 않은 값이 저장되어 있으면 system을 반환한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('invalid');

    // When
    const result = readLanguageMode(storage);

    // Then
    expect(result).toBe('system');
  });
});

describe('writeLanguageMode', () => {
  it('올바른 key와 value로 storage.set을 호출한다', () => {
    // Given
    const storage = createMockSyncStorage();

    // When
    writeLanguageMode(storage, 'en');

    // Then
    expect(storage.set).toHaveBeenCalledWith('aido_language', 'en');
  });
});

describe('resolveLanguage', () => {
  it.each(['ko', 'en'] as const)('%s 모드는 기기 언어와 무관하게 %s를 반환한다', (mode) => {
    expect(resolveLanguage(mode, 'ja')).toBe(mode);
  });

  it('system 모드에서 기기 언어가 ko이면 ko를 반환한다', () => {
    expect(resolveLanguage('system', 'ko')).toBe('ko');
  });

  it.each(['en', 'ja', 'fr', 'zh'])(
    'system 모드에서 기기 언어가 %s이면 en을 반환한다',
    (deviceLanguage) => {
      expect(resolveLanguage('system', deviceLanguage)).toBe('en');
    },
  );

  it.each([undefined, null])('system 모드에서 기기 언어가 %s이면 en을 반환한다', (value) => {
    expect(resolveLanguage('system', value)).toBe('en');
  });
});
