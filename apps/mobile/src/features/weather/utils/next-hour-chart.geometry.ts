import { area, curveMonotoneX, line } from 'd3-shape';
import { clamp, sumBy, zip } from 'es-toolkit';

import type { MinuteForecast } from '../schemas/weather-report.schema';

/** 그래프 좌표계. 화면에서는 viewBox로 폭에 맞춰 같은 비율로 늘린다. */
export const NEXT_HOUR_CHART_SIZE = { width: 326, height: 92, baseline: 84, top: 8 } as const;

const PRECIPITATION_LEVELS = ['light', 'moderate', 'heavy'] as const;
export type PrecipitationLevel = (typeof PRECIPITATION_LEVELS)[number];

/** 강도(mm/h) → 그래프 높이(0~1). 2.5mm/h 미만은 약함, 7.6mm/h 미만은 보통, 그 이상은 강함이다. */
const INTENSITY_STOPS = [
  { intensity: 0, level: 0 },
  { intensity: 2.5, level: 1 / 3 },
  { intensity: 7.6, level: 2 / 3 },
  { intensity: 15, level: 1 },
] as const;
/** 단조 곡선은 점 사이 직선보다 조금 길다. 그리는 애니메이션의 대시가 선보다 짧지 않게 여유를 둔다. */
const CURVE_LENGTH_MARGIN = 1.15;

function toPrecipitationLevel(intensity: number): number {
  const upperIndex = INTENSITY_STOPS.findIndex((stop) => intensity <= stop.intensity);
  if (upperIndex === -1) {
    return 1;
  }
  const upper = INTENSITY_STOPS[upperIndex];
  const lower = INTENSITY_STOPS[upperIndex - 1];
  if (upper == null || lower == null) {
    return 0;
  }
  const ratio = (intensity - lower.intensity) / (upper.intensity - lower.intensity);
  return clamp(lower.level + ratio * (upper.level - lower.level), 0, 1);
}

interface NextHourChartGuide {
  level: PrecipitationLevel;
  y: number;
}

export interface NextHourChart {
  line: string;
  area: string;
  /** 선 길이의 넉넉한 추정치. stroke-dasharray·dashoffset에 쓴다. */
  length: number;
  guides: NextHourChartGuide[];
}

function toY(level: number): number {
  const { baseline, top } = NEXT_HOUR_CHART_SIZE;
  return baseline - level * (baseline - top);
}

/** 분 단위 강도를 단조 곡선(0 아래로 튀지 않음)으로 잇는다. 점이 둘 미만이면 그리지 않는다. */
export function toNextHourChart(minutes: readonly MinuteForecast[]): NextHourChart | null {
  if (minutes.length < 2) {
    return null;
  }
  const { width, baseline } = NEXT_HOUR_CHART_SIZE;
  const points = minutes.map((minute, index): [number, number] => [
    (index / (minutes.length - 1)) * width,
    toY(toPrecipitationLevel(minute.precipitationIntensity)),
  ]);
  const linePath = line().curve(curveMonotoneX)(points);
  const areaPath = area().y0(baseline).curve(curveMonotoneX)(points);
  if (linePath == null || areaPath == null) {
    return null;
  }
  const segments = zip(points.slice(0, -1), points.slice(1));
  const polylineLength = sumBy(segments, ([[x1, y1], [x2, y2]]) => Math.hypot(x2 - x1, y2 - y1));

  return {
    line: linePath,
    area: areaPath,
    length: Math.ceil(polylineLength * CURVE_LENGTH_MARGIN),
    guides: PRECIPITATION_LEVELS.map((level, index) => ({
      level,
      y: toY((index + 1) / PRECIPITATION_LEVELS.length),
    })),
  };
}
