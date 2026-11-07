import { FONT_SCALE_STORAGE_KEY, isFontScale, toFontScale } from './font-scale.preference';

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

describe('toFontScale', () => {
  it('저장된 값이 없으면 medium을 반환한다', () => {
    // When
    const result = toFontScale(undefined);

    // Then
    expect(result).toBe('medium');
  });

  it.each(['xsmall', 'small', 'medium', 'large', 'xlarge'] as const)(
    '%s가 저장되어 있으면 그대로 반환한다',
    (saved) => {
      // When
      const result = toFontScale(saved);

      // Then
      expect(result).toBe(saved);
    },
  );

  it('유효하지 않은 값이 저장되어 있으면 medium을 반환한다', () => {
    // When
    const result = toFontScale('invalid');

    // Then
    expect(result).toBe('medium');
  });
});

describe('저장 키', () => {
  it('이미 설치된 앱의 저장 값을 읽도록 키를 바꾸지 않는다', () => {
    // Then
    expect(FONT_SCALE_STORAGE_KEY).toBe('aido_font_scale');
  });
});
