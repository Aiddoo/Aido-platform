import type { FontScale } from '@src/shared/preferences/font-scale.preference';

/** b2 토큰이 FontScale별로 리매핑되는 실제 px 값 (font-scale-provider.tsx SCALE_MAP, global.css @theme 기준) */
export const SCALED_FONT_STYLES: Record<FontScale, { fontSize: number; lineHeight: number }> = {
  xsmall: { fontSize: 13, lineHeight: 19 },
  small: { fontSize: 15, lineHeight: 20 },
  medium: { fontSize: 16, lineHeight: 23 },
  large: { fontSize: 17, lineHeight: 24 },
  xlarge: { fontSize: 20, lineHeight: 28 },
};

/** FontScale에 대응하는 b2 기준 fontSize(px)를 반환한다. */
export function getScaledFontSize(scale: FontScale): number {
  return SCALED_FONT_STYLES[scale].fontSize;
}
