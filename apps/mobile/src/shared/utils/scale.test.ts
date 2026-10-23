import { scaleByFontScale } from './scale';

describe('scaleByFontScale', () => {
  describe('기본 ratio (0.5)', () => {
    it('글꼴 배율 1x이면 원래 크기를 반환한다', () => {
      expect(scaleByFontScale(32, 1)).toBe(32);
    });

    it('글꼴 배율 1.5x이면 50% 반영된 40px을 반환한다', () => {
      // 32 * (1 + (1.5 - 1) * 0.5) = 40
      expect(scaleByFontScale(32, 1.5)).toBe(40);
    });

    it('글꼴 배율 2x이면 50% 반영된 30px을 반환한다', () => {
      // 20 * (1 + (2 - 1) * 0.5) = 30
      expect(scaleByFontScale(20, 2)).toBe(30);
    });
  });

  describe('커스텀 ratio', () => {
    it('ratio 0이면 원래 크기를 반환한다', () => {
      expect(scaleByFontScale(32, 2, 0)).toBe(32);
    });

    it('ratio 1이면 100% 반영된 48px을 반환한다', () => {
      // 32 * (1 + (1.5 - 1) * 1) = 48
      expect(scaleByFontScale(32, 1.5, 1)).toBe(48);
    });
  });

  describe('반올림', () => {
    it('소수점 결과는 반올림된 정수를 반환한다', () => {
      // 18 * (1 + (1.3 - 1) * 0.5) = 20.7 → 21
      expect(scaleByFontScale(18, 1.3)).toBe(21);
    });
  });
});
