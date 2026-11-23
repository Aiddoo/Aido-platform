import { MAX_COMPLETION_RATE_PERCENT } from '@src/shared/domains/completion-rate.model';
import { area, curveMonotoneX, line } from 'd3-shape';
import { clamp } from 'es-toolkit';

const GUIDE_STEP_RATE = 10;
/** 가장 낮은·높은 주와 기준선 사이 여유 */
const GUIDE_PADDING_RATE = 5;
/** 주마다 값이 거의 같아도 기울기가 부풀지 않게 두 기준선 사이를 이만큼은 둔다 */
const MIN_GUIDE_SPAN_RATE = 30;

export interface TrendView {
  width: number;
  height: number;
  insetLeft: number;
  insetRight: number;
  insetTop: number;
  insetBottom: number;
}

export interface TrendPoint {
  x: number;
  y: number;
}

export interface TrendGuide {
  rate: number;
  y: number;
}

export interface CompletionTrend {
  line: string;
  area: string;
  points: TrendPoint[];
  /** 위·아래 기준선. 점은 늘 둘 사이에 있다 */
  guides: { upper: TrendGuide; lower: TrendGuide };
}

/** 고정 좌표계(view)의 추세선. 화면 폭에 맞춰 늘리는 것은 그리는 쪽이 한다 */
export function toCompletionTrend(
  values: readonly number[],
  view: TrendView,
): CompletionTrend | null {
  const { width, height, insetLeft, insetRight, insetTop, insetBottom } = view;
  const { lower, upper } = getGuideRange(values);
  const innerWidth = width - insetLeft - insetRight;
  const innerHeight = height - insetTop - insetBottom;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  const toY = (rate: number) =>
    insetTop + (1 - (clamp(rate, lower, upper) - lower) / (upper - lower)) * innerHeight;
  const points = values.map((value, index): [number, number] => [
    values.length > 1 ? insetLeft + index * step : width - insetRight,
    toY(value),
  ]);
  const linePath = line().curve(curveMonotoneX)(points);
  const areaPath = area()
    .y0(height - insetBottom)
    .curve(curveMonotoneX)(points);
  if (points.length === 0 || linePath == null || areaPath == null) {
    return null;
  }

  return {
    line: linePath,
    area: areaPath,
    points: points.map(([x, y]) => ({ x, y })),
    guides: {
      upper: { rate: upper, y: toY(upper) },
      lower: { rate: lower, y: toY(lower) },
    },
  };
}

/** 누른 x에서 가장 가까운 주. 화면 폭을 view 좌표로 되돌려 찾는다 */
export function toTrendPointIndex(
  x: number,
  chartWidth: number,
  view: TrendView,
  pointCount: number,
): number {
  'worklet';
  if (chartWidth <= 0 || pointCount <= 1) {
    return Math.max(0, pointCount - 1);
  }
  const step = (view.width - view.insetLeft - view.insetRight) / (pointCount - 1);
  const viewX = (x / chartWidth) * view.width;
  return Math.min(pointCount - 1, Math.max(0, Math.round((viewX - view.insetLeft) / step)));
}

// 기준선은 10% 단위로 값 바깥에 둔다(59~78% → 50·90%). 좁으면 위로, 100%에 닿으면 아래로 넓힌다
function getGuideRange(values: readonly number[]): { lower: number; upper: number } {
  const lower = clamp(
    Math.floor((Math.min(...values) - GUIDE_PADDING_RATE) / GUIDE_STEP_RATE) * GUIDE_STEP_RATE,
    0,
    MAX_COMPLETION_RATE_PERCENT,
  );
  const upper = clamp(
    Math.ceil((Math.max(...values) + GUIDE_PADDING_RATE) / GUIDE_STEP_RATE) * GUIDE_STEP_RATE,
    0,
    MAX_COMPLETION_RATE_PERCENT,
  );
  const widenedUpper = Math.min(
    MAX_COMPLETION_RATE_PERCENT,
    Math.max(upper, lower + MIN_GUIDE_SPAN_RATE),
  );
  return {
    lower: Math.max(0, Math.min(lower, widenedUpper - MIN_GUIDE_SPAN_RATE)),
    upper: widenedUpper,
  };
}
