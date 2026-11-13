import { isLanguageMode, resolveLanguage } from './language.preference';

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
