import { DAY_MS } from '@src/shared/constants/time-units';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { round } from 'es-toolkit';

import type { DailyForecastEntry } from '../schemas/weather-report.schema';
import { toUnitPosition } from './weather-bar.geometry';
import type { DialPoint } from './weather-dial.geometry';

export const SUN_ARC_VIEWBOX = { width: 326, height: 96 } as const;

type CubicCurve = readonly [DialPoint, DialPoint, DialPoint, DialPoint];

/** 시안의 해 궤적 path와 같은 조정점이다. 낮은 두 곡선, 밤은 지평선 아래 양 끝 곡선이다. */
const SUNRISE_TO_NOON: CubicCurve = [
  { x: 58, y: 70 },
  { x: 100, y: 70 },
  { x: 130, y: 14 },
  { x: 163, y: 14 },
];
const NOON_TO_SUNSET: CubicCurve = [
  { x: 163, y: 14 },
  { x: 196, y: 14 },
  { x: 226, y: 70 },
  { x: 268, y: 70 },
];
const NIGHT_BEFORE_SUNRISE: CubicCurve = [
  { x: 0, y: 84 },
  { x: 30, y: 84 },
  { x: 40, y: 92 },
  { x: 58, y: 70 },
];
const NIGHT_AFTER_SUNSET: CubicCurve = [
  { x: 268, y: 70 },
  { x: 286, y: 92 },
  { x: 296, y: 84 },
  { x: 326, y: 84 },
];

function pointOnCurve([p0, p1, p2, p3]: CubicCurve, t: number): DialPoint {
  const u = 1 - t;
  const at = (a: number, b: number, c: number, d: number) =>
    round(u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d, 2);
  return { x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) };
}

/**
 * 해 궤적 위 지금 해의 자리. 낮은 일출~일몰을 두 곡선에 시간 비율로 놓는다.
 * 밤은 반으로 나눠 일몰 뒤 반나절은 오른쪽 끝 곡선, 일출 전 반나절은 왼쪽 끝 곡선에 둔다.
 * 일출·일몰 중 하나라도 없으면(백야·극야 등) 자리를 정할 수 없어 null이다.
 */
export function getSunArcPosition(
  day: Pick<DailyForecastEntry, 'sunrise' | 'sunset'>,
  now: Instant,
): DialPoint | null {
  const { sunrise, sunset } = day;
  if (sunrise == null || sunset == null) {
    return null;
  }
  const rise = toEpochMs(sunrise);
  const set = toEpochMs(sunset);
  const current = toEpochMs(now);
  const halfNight = (DAY_MS - (set - rise)) / 2;
  if (current < rise) {
    return pointOnCurve(NIGHT_BEFORE_SUNRISE, toUnitPosition(current, rise - halfNight, rise));
  }
  if (current > set) {
    return pointOnCurve(NIGHT_AFTER_SUNSET, toUnitPosition(current, set, set + halfNight));
  }
  const noon = (rise + set) / 2;
  return current < noon
    ? pointOnCurve(SUNRISE_TO_NOON, toUnitPosition(current, rise, noon))
    : pointOnCurve(NOON_TO_SUNSET, toUnitPosition(current, noon, set));
}

/** 일출 전이나 일몰 뒤면 해 점을 밤처럼 흐리게 그린다. 일출·일몰을 모르면 낮으로 본다. */
export function isSunBelowHorizon(
  day: Pick<DailyForecastEntry, 'sunrise' | 'sunset'>,
  now: Instant,
): boolean {
  if (day.sunrise == null || day.sunset == null) {
    return false;
  }
  return toEpochMs(now) < toEpochMs(day.sunrise) || toEpochMs(now) > toEpochMs(day.sunset);
}
