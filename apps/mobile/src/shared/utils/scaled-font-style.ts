import type { FontScale } from '@src/shared/preferences/font-scale.preference';

/** b2 토큰이 글꼴 크기 설정별로 바뀌는 실제 px 값 (font-scale-provider.tsx SCALE_MAP, global.css @theme 기준) */
const B2_FONT_SIZE_BY_SCALE = {
  xsmall: 13,
  small: 15,
  medium: 16,
  large: 17,
  xlarge: 20,
} as const satisfies Record<FontScale, number>;

export function getScaledFontSize(scale: FontScale): number {
  return B2_FONT_SIZE_BY_SCALE[scale];
}
