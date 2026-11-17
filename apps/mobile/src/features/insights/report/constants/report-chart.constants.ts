import { Easing } from 'react-native-reanimated';

import type { BarShape } from '../utils/bar-chart.geometry';
import type { TrendView } from '../utils/completion-trend.geometry';

// 차트와 .Loading이 같은 비율을 써야 받은 뒤 자리가 움직이지 않는다
export const DAILY_CHART_ASPECT_RATIO = 3;
export const HOUR_CHART_ASPECT_RATIO = 3.5;
export const COMPLETION_TREND_ASPECT_RATIO = 3;

export const CHART_LABEL_GAP_PT = 6;

/**
 * 손가락이 이보다 멀리 움직이면 탭을 실패시켜, 차트 위에서 시작한 세로 스크롤이 손을 뗀 자리의 칸을 고르지 않는다.
 * Android 스크롤이 시작되는 거리(ViewConfiguration touch slop 8dp)와 같다
 */
export const CHART_TAP_MAX_DISTANCE_PT = 8;
/** 세로 스크롤과 다투지 않게 가로로 먼저 움직일 때만 밀기로 잡고, 세로로 먼저 움직이면 스크롤에 넘긴다 */
export const CHART_PAN_ACTIVE_OFFSET_X_PT = 8;
export const CHART_PAN_FAIL_OFFSET_Y_PT = 12;

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

/**
 * 추세선의 고정 좌표계. 왼쪽은 기준선 라벨("100%"), 위는 고른 주 값 라벨 자리다.
 * 폭이 가장 좁은 SE의 큰 글꼴에서도 라벨이 들어가는 값이고, 폭에 비례해 늘어난다
 */
export const COMPLETION_TREND_VIEW = {
  width: 240,
  height: 240 / COMPLETION_TREND_ASPECT_RATIO,
  insetLeft: 34,
  insetRight: 10,
  insetTop: 22,
  insetBottom: 8,
} as const satisfies TrendView;

export const CHART_REVEAL_EASING = Easing.out(Easing.cubic);
