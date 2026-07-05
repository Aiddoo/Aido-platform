import { PixelRatio } from 'react-native';
import { fontScaledSize } from './scale';

jest.mock('react-native', () => ({
  // jest-expo 57이 설치하는 expo/fetch 글로벌이 Platform.select를 요구한다
  Platform: {
    OS: 'ios',
    select: (specifics: Record<string, unknown>) => specifics.ios ?? specifics.default,
  },
  PixelRatio: {
    getFontScale: jest.fn(),
  },
}));

const mockGetFontScale = PixelRatio.getFontScale as jest.Mock;

describe('fontScaledSize', () => {
  describe('기본 ratio (0.5)', () => {
    it('시스템 글꼴 1x이면 원래 크기를 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1);

      // When
      const result = fontScaledSize(32);

      // Then
      expect(result).toBe(32);
    });

    it('시스템 글꼴 1.5x이면 50% 반영된 40px을 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1.5);

      // When
      const result = fontScaledSize(32);

      // Then
      // 32 * (1 + (1.5 - 1) * 0.5) = 32 * 1.25 = 40
      expect(result).toBe(40);
    });

    it('시스템 글꼴 2x이면 50% 반영된 30px을 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(2);

      // When
      const result = fontScaledSize(20);

      // Then
      // 20 * (1 + (2 - 1) * 0.5) = 20 * 1.5 = 30
      expect(result).toBe(30);
    });
  });

  describe('커스텀 ratio', () => {
    it('ratio 0.5이면 50% 반영된 40px을 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1.5);

      // When
      const result = fontScaledSize(32, 0.5);

      // Then
      // 32 * (1 + (1.5 - 1) * 0.5) = 32 * 1.25 = 40
      expect(result).toBe(40);
    });

    it('ratio 0이면 원래 크기를 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(2);

      // When
      const result = fontScaledSize(32, 0);

      // Then
      expect(result).toBe(32);
    });

    it('ratio 1이면 100% 반영된 48px을 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1.5);

      // When
      const result = fontScaledSize(32, 1);

      // Then
      // 32 * (1 + (1.5 - 1) * 1) = 32 * 1.5 = 48
      expect(result).toBe(48);
    });
  });

  describe('반올림', () => {
    it('소수점 결과는 반올림된 정수를 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1.3);

      // When
      const result = fontScaledSize(18);

      // Then
      // 18 * (1 + (1.3 - 1) * 0.5) = 18 * 1.15 = 20.7 → 21
      expect(result).toBe(21);
    });
  });
});
