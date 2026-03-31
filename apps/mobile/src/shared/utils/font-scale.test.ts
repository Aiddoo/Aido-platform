import type { FontScale } from '@src/shared/preferences/font-scale.preference';
import { getScaledFontSize, SCALED_FONT_STYLES } from './font-scale';

describe('SCALED_FONT_STYLES', () => {
  it('5개의 FontScale에 대한 스타일을 모두 포함한다', () => {
    // Given
    const scales: FontScale[] = ['xsmall', 'small', 'medium', 'large', 'xlarge'];

    // When & Then
    for (const scale of scales) {
      expect(SCALED_FONT_STYLES[scale]).toBeDefined();
      expect(SCALED_FONT_STYLES[scale].fontSize).toBeGreaterThan(0);
      expect(SCALED_FONT_STYLES[scale].lineHeight).toBeGreaterThan(0);
    }
  });

  it('fontSize는 scale이 커질수록 증가한다', () => {
    // Given & When
    const xsmall = SCALED_FONT_STYLES.xsmall.fontSize;
    const small = SCALED_FONT_STYLES.small.fontSize;
    const medium = SCALED_FONT_STYLES.medium.fontSize;
    const large = SCALED_FONT_STYLES.large.fontSize;
    const xlarge = SCALED_FONT_STYLES.xlarge.fontSize;

    // Then
    expect(small).toBeGreaterThan(xsmall);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
    expect(xlarge).toBeGreaterThan(large);
  });

  it('lineHeight는 항상 fontSize보다 크다', () => {
    // Given
    const scales: FontScale[] = ['xsmall', 'small', 'medium', 'large', 'xlarge'];

    // When & Then
    for (const scale of scales) {
      const { fontSize, lineHeight } = SCALED_FONT_STYLES[scale];
      expect(lineHeight).toBeGreaterThan(fontSize);
    }
  });
});

describe('getScaledFontSize', () => {
  it('medium이면 기본 b2 크기인 16px을 반환한다', () => {
    // Given
    const scale: FontScale = 'medium';

    // When
    const result = getScaledFontSize(scale);

    // Then
    expect(result).toBe(16);
  });

  it('xsmall이면 b4 크기인 13px을 반환한다', () => {
    // Given
    const scale: FontScale = 'xsmall';

    // When
    const result = getScaledFontSize(scale);

    // Then
    expect(result).toBe(13);
  });

  it('xlarge이면 t3 크기인 20px을 반환한다', () => {
    // Given
    const scale: FontScale = 'xlarge';

    // When
    const result = getScaledFontSize(scale);

    // Then
    expect(result).toBe(20);
  });

  it.each([
    ['xsmall', 13],
    ['small', 15],
    ['medium', 16],
    ['large', 17],
    ['xlarge', 20],
  ] as const)('%s이면 %dpx을 반환한다', (scale, expected) => {
    // Given & When
    const result = getScaledFontSize(scale);

    // Then
    expect(result).toBe(expected);
  });
});
