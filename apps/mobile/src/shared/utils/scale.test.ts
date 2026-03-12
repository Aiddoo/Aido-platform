import { PixelRatio } from 'react-native';
import { fontScaledSize } from './scale';

jest.mock('react-native', () => ({
  PixelRatio: {
    getFontScale: jest.fn(),
  },
}));

const mockGetFontScale = PixelRatio.getFontScale as jest.Mock;

describe('fontScaledSize', () => {
  describe('기본 ratio (0.5)', () => {
    it('Given 시스템 글꼴이 기본(1x)일 때 When 32px을 스케일링하면 Then 원래 크기를 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1);

      // When
      const result = fontScaledSize(32);

      // Then
      expect(result).toBe(32);
    });

    it('Given 시스템 글꼴이 1.5x일 때 When 32px을 스케일링하면 Then 50% 반영된 40px을 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1.5);

      // When
      const result = fontScaledSize(32);

      // Then
      // 32 * (1 + (1.5 - 1) * 0.5) = 32 * 1.25 = 40
      expect(result).toBe(40);
    });

    it('Given 시스템 글꼴이 2x일 때 When 20px을 스케일링하면 Then 50% 반영된 30px을 반환한다', () => {
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
    it('Given ratio가 0.5일 때 When 글꼴 1.5x에서 32px을 스케일링하면 Then 50% 반영된 40px을 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(1.5);

      // When
      const result = fontScaledSize(32, 0.5);

      // Then
      // 32 * (1 + (1.5 - 1) * 0.5) = 32 * 1.25 = 40
      expect(result).toBe(40);
    });

    it('Given ratio가 0일 때 When 글꼴 2x에서 32px을 스케일링하면 Then 원래 크기를 반환한다', () => {
      // Given
      mockGetFontScale.mockReturnValue(2);

      // When
      const result = fontScaledSize(32, 0);

      // Then
      expect(result).toBe(32);
    });

    it('Given ratio가 1일 때 When 글꼴 1.5x에서 32px을 스케일링하면 Then 100% 반영된 48px을 반환한다', () => {
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
    it('Given 소수점 결과가 나올 때 When 스케일링하면 Then 반올림된 정수를 반환한다', () => {
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
