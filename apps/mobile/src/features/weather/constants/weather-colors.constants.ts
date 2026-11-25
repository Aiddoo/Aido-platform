/** 하늘 장면 위 날씨 카드에서만 쓰는 시안 색. 흰 글자·선은 on-sky 토큰을 쓴다. */

/** 좋음·잔잔함 조언 글자가 함께 쓰는 연두 */
const MINT_ADVICE_TEXT_CLASS = 'text-[#BDF5CF]';

/** 브리핑 할 일 행의 조언 글자색과 칩 바탕색 */
export const BRIEFING_ROW_TONES = {
  warning: { advice: 'text-[#FFD2A6]', chip: 'bg-[rgba(255,160,70,0.24)]' },
  heat: { advice: 'text-[#FFF0BF]', chip: 'bg-[rgba(255,90,40,0.3)]' },
  good: { advice: MINT_ADVICE_TEXT_CLASS, chip: 'bg-[rgba(74,222,128,0.24)]' },
  calm: { advice: MINT_ADVICE_TEXT_CLASS, chip: 'bg-on-sky/14' },
  neutral: { advice: 'text-on-sky/85', chip: 'bg-on-sky/14' },
} as const;
export type BriefingRowTone = keyof typeof BRIEFING_ROW_TONES;

/** 특보 카드는 같은 유리 카드를 주황으로 물들인다. */
export const ALERT_SURFACE_COLORS = {
  light: 'rgba(150,60,20,0.32)',
  dark: 'rgba(255,138,61,0.16)',
  opaque: '#3A2414',
  edge: 'rgba(255,210,170,0.45)',
} as const;
export const ALERT_GLYPH_COLORS = { triangle: '#FFC48F', mark: '#3A2210' } as const;

export const PRECIPITATION_CHANCE_TEXT_CLASS = 'text-[#8FD0FF]';
export const TODO_DOT_COLOR = '#FF8A65';

export const NEXT_HOUR_CHART_COLORS = { line: '#9AD5FF', area: '#7CC8FF' } as const;

/** 해 둘레의 번짐과 해 자체의 노랑. 해 그림(`WeatherIcon`)과 해 궤도의 해 점이 같은 노랑을 쓴다 */
export const SUN_COLORS = { glow: '#FFE29A', yellow: '#FFD54A' } as const;

export const UV_METER_COLORS = ['#4ADE80', '#FACC15', '#FB923C', '#EF4444', '#A855F7'] as const;
export const AIR_METER_COLORS = ['#4ADE80', '#FACC15', '#FB923C', '#EF4444'] as const;

export const ALERT_GLYPH_BACKGROUND_CLASS = 'bg-[rgba(255,170,90,0.28)]';

export const LIGHT_BUTTON_TEXT_CLASS = 'text-[#383838]';

export const HERO_TEXT_SHADOW_COLOR = 'rgba(0,0,0,0.08)';
