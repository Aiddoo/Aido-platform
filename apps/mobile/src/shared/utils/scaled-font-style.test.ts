import { getScaledFontSize } from './scaled-font-style';

describe('getScaledFontSize', () => {
  it('글꼴 크기 설정이 커질수록 글자도 커진다', () => {
    // When
    const sizes = (['xsmall', 'small', 'medium', 'large', 'xlarge'] as const).map(
      getScaledFontSize,
    );

    // Then
    sizes.slice(1).forEach((size, index) => {
      expect(size).toBeGreaterThan(sizes[index] ?? Number.POSITIVE_INFINITY);
    });
  });
});
