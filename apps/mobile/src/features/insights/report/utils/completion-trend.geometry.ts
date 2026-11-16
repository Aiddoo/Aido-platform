import { area, curveMonotoneX, line } from 'd3-shape';
import { clamp } from 'es-toolkit';

const MAX_COMPLETION_RATE = 100;

export interface CompletionTrend {
  line: string;
  area: string;
  end: { x: number; y: number };
}

interface TrendView {
  width: number;
  height: number;
  inset: number;
}

export function toCompletionTrend(
  values: readonly number[],
  view: TrendView,
): CompletionTrend | null {
  const { width, height, inset } = view;
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  const points = values.map((value, index): [number, number] => [
    values.length > 1 ? inset + index * step : width - inset,
    inset + (1 - clamp(value, 0, MAX_COMPLETION_RATE) / MAX_COMPLETION_RATE) * innerHeight,
  ]);
  const last = points.at(-1);
  const linePath = line().curve(curveMonotoneX)(points);
  const areaPath = area().y0(height).curve(curveMonotoneX)(points);
  if (last == null || linePath == null || areaPath == null) {
    return null;
  }

  return { line: linePath, area: areaPath, end: { x: last[0], y: last[1] } };
}
