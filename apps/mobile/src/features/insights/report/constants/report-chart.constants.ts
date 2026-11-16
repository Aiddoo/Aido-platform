import { Easing } from 'react-native-reanimated';

import type { BarShape } from '../utils/bar-chart.geometry';

// 차트와 .Loading이 같은 비율을 써야 받은 뒤 자리가 움직이지 않는다
export const DAILY_CHART_ASPECT_RATIO = 3;
export const HOUR_CHART_ASPECT_RATIO = 3.5;
export const COMPLETION_TREND_ASPECT_RATIO = 4.5;

export const CHART_LABEL_GAP_PT = 6;

/** 최근 리포트 카드의 주별 완료율 추세에 그리는 주 수 */
export const TREND_WEEK_COUNT = 8;

export const DAILY_CHART_BAR = {
  widthRatio: 0.55,
  cornerRadius: 8,
  minHeight: 4,
} as const satisfies BarShape;

export const HOUR_CHART_BAR = {
  widthRatio: 0.65,
  cornerRadius: 3,
  minHeight: 2,
} as const satisfies BarShape;

export const COMPLETION_TREND_VIEW = {
  width: 240,
  height: 240 / COMPLETION_TREND_ASPECT_RATIO,
  inset: 10,
} as const;

export const CHART_REVEAL_EASING = Easing.out(Easing.cubic);
