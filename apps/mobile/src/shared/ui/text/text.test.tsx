import { textVariants } from './text.variants';

describe('textVariants 함수', () => {
  it('모든 크기에서 색상 클래스를 지우지 않아야 한다', () => {
    // Given 흰 글자를 요청하고 When 각 크기로 병합하면 Then 크기와 색이 함께 남는다
    for (const size of ['display', 'h1', 'b1', 'e2'] as const) {
      const classes = textVariants({ size, tone: 'white' }).split(' ');
      expect(classes).toEqual(expect.arrayContaining([`text-${size}`, 'text-white']));
    }
  });
});
