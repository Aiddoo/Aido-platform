import type { FontScale } from '@src/shared/preferences/font-scale.preference';

/**
 * FontScale별로 b2 토큰이 리매핑되는 실제 px 값.
 *
 * | FontScale | b2 → 토큰 | fontSize | lineHeight |
 * |-----------|-----------|----------|------------|
 * | xsmall    | b2 → b4   | 13px     | 19px       |
 * | small     | b2 → b3   | 15px     | 20px       |
 * | medium    | b2        | 16px     | 23px       |
 * | large     | b2 → b1   | 17px     | 24px       |
 * | xlarge    | b2 → t3   | 20px     | 28px       |
 *
 * @see font-scale-provider.tsx SCALE_MAP — 리매핑 테이블
 * @see global.css @theme — 디자인 토큰 원본 정의
 */
export const SCALED_FONT_STYLES: Record<FontScale, { fontSize: number; lineHeight: number }> = {
  xsmall: { fontSize: 13, lineHeight: 19 },
  small: { fontSize: 15, lineHeight: 20 },
  medium: { fontSize: 16, lineHeight: 23 },
  large: { fontSize: 17, lineHeight: 24 },
  xlarge: { fontSize: 20, lineHeight: 28 },
};

/** FontScale에 대응하는 b2 기준 fontSize(px)를 반환한다. */
export const getScaledFontSize = (scale: FontScale): number => {
  return SCALED_FONT_STYLES[scale].fontSize;
};
