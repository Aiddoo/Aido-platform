import {
  isLanguageMode,
  toLanguageMode,
  LANGUAGE_MODE_STORAGE_KEY,
  resolveLanguage,
} from './language.preference';

describe('isLanguageMode', () => {
  it.each(['system', 'ko', 'en'] as const)('%s는 유효한 LanguageMode이다', (value) => {
    // When
    const result = isLanguageMode(value);

    // Then
    expect(result).toBe(true);
  });

  it.each([undefined, null, '', 'invalid', 'ja', 123, true])(
    '%s는 유효한 LanguageMode가 아니다',
    (value) => {
      // When
      const result = isLanguageMode(value);

      // Then
      expect(result).toBe(false);
    },
  );
});

describe('toLanguageMode', () => {
  it('저장된 값이 없으면 system을 반환한다', () => {
    // When
    const result = toLanguageMode(undefined);

    // Then
    expect(result).toBe('system');
  });

  it.each(['system', 'ko', 'en'] as const)('%s가 저장되어 있으면 그대로 반환한다', (saved) => {
    // When
    const result = toLanguageMode(saved);

    // Then
    expect(result).toBe(saved);
  });

  it('유효하지 않은 값이 저장되어 있으면 system을 반환한다', () => {
    // When
    const result = toLanguageMode('invalid');

    // Then
    expect(result).toBe('system');
  });
});

describe('저장 키', () => {
  it('이미 설치된 앱의 저장 값을 읽도록 키를 바꾸지 않는다', () => {
    // Then
    expect(LANGUAGE_MODE_STORAGE_KEY).toBe('aido_language');
  });
});

describe('resolveLanguage', () => {
  it.each(['ko', 'en'] as const)('%s 모드는 기기 언어와 무관하게 %s를 반환한다', (mode) => {
    // When
    const result = resolveLanguage(mode, 'ja');

    // Then
    expect(result).toBe(mode);
  });

  it('system 모드에서 기기 언어가 ko이면 ko를 반환한다', () => {
    // When
    const result = resolveLanguage('system', 'ko');

    // Then
    expect(result).toBe('ko');
  });

  it.each(['en', 'ja', 'fr', 'zh'])(
    'system 모드에서 기기 언어가 %s이면 en을 반환한다',
    (deviceLanguage) => {
      // When
      const result = resolveLanguage('system', deviceLanguage);

      // Then
      expect(result).toBe('en');
    },
  );

  it.each([undefined, null])('system 모드에서 기기 언어가 %s이면 en을 반환한다', (value) => {
    // When
    const result = resolveLanguage('system', value);

    // Then
    expect(result).toBe('en');
  });
});
