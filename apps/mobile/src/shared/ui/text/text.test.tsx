import { textVariants } from './text.variants';

describe('textVariants', () => {
  it.each(['display', 'h1', 'b1', 'e2'] as const)(
    '%s 크기로 병합해도 흰 글자 색 클래스를 지우지 않는다',
    (size) => {
      // Given
      const tone = 'white';

      // When
      const classes = textVariants({ size, tone }).split(' ');

      // Then
      expect(classes).toEqual(expect.arrayContaining([`text-${size}`, 'text-white']));
    },
  );
});
