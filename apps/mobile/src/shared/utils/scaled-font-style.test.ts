import type { FontScale } from '@src/shared/preferences/font-scale.preference';

import { getScaledFontSize, SCALED_FONT_STYLES } from './scaled-font-style';

describe('SCALED_FONT_STYLES', () => {
  it('5개의 FontScale에 대한 스타일을 모두 포함한다', () => {
    // Given
    const scales: FontScale[] = ['xsmall', 'small', 'medium', 'large', 'xlarge'];

    // When
    const styles = scales.map((scale) => SCALED_FONT_STYLES[scale]);

    // Then
    for (const style of styles) {
      expect(style).toBeDefined();
      expect(style.fontSize).toBeGreaterThan(0);
      expect(style.lineHeight).toBeGreaterThan(0);
    }
  });

  it('fontSize는 scale이 커질수록 증가한다', () => {
    // When
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

    // When
    const styles = scales.map((scale) => SCALED_FONT_STYLES[scale]);

    // Then
    for (const { fontSize, lineHeight } of styles) {
      expect(lineHeight).toBeGreaterThan(fontSize);
    }
  });
});

describe('getScaledFontSize', () => {
  it.each([
    ['xsmall', 13],
    ['small', 15],
    ['medium', 16],
    ['large', 17],
    ['xlarge', 20],
  ] as const)('%s이면 %dpx을 반환한다', (scale, expected) => {
    // When
    const result = getScaledFontSize(scale);

    // Then
    expect(result).toBe(expected);
  });
});
