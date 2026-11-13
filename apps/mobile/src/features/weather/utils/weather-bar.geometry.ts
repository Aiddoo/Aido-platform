import { clamp, maxBy, minBy } from 'es-toolkit';

import { type AirPollutant, getPollutantUpperBounds } from '../domains/weather-indicator.model';
import type { DailyForecastEntry } from '../domains/weather-report.model';

/** 막대 끝에 점이 반쯤 잘리지 않도록 3%~97% 안에 둔다. */
const METER_MIN = 0.03;
const METER_MAX = 0.97;
/** 자외선 막대는 0~11+(위험)까지를 한 줄로 그린다. */
const UV_METER_MAX = 11;

/** 막대를 등급 4칸으로 똑같이 나누고, 매우 나쁨 칸은 마지막 기준의 두 배까지 펼친다. */
function toAirMeterBounds(pollutant: AirPollutant): readonly number[] {
  const upperBounds = getPollutantUpperBounds(pollutant);
  return [0, ...upperBounds, upperBounds[2] * 2];
}

const AIR_METER_BOUNDS = {
  pm10: toAirMeterBounds('pm10'),
  pm25: toAirMeterBounds('pm25'),
} as const satisfies Record<AirPollutant, readonly number[]>;

/** 0~1 막대·궤적 위 자리. 범위를 벗어나면 양 끝에 두고, 폭이 1보다 좁으면 1로 본다. */
export function toUnitPosition(value: number, min: number, max: number): number {
  return clamp((value - min) / Math.max(max - min, 1), 0, 1);
}

export function toUvMeterPosition(uvIndex: number): number {
  return clamp(uvIndex / UV_METER_MAX, METER_MIN, METER_MAX);
}

export function toAirMeterPosition(value: number, pollutant: AirPollutant): number {
  const bounds = AIR_METER_BOUNDS[pollutant];
  const segmentCount = bounds.length - 1;
  const upperIndex = bounds.findIndex((bound, position) => position > 0 && value <= bound);
  const index = upperIndex === -1 ? segmentCount - 1 : upperIndex - 1;
  const lower = bounds[index] ?? 0;
  const upper = bounds[index + 1] ?? lower;
  const withinSegment = value > upper ? 1 : (value - lower) / Math.max(upper - lower, 1);
  return clamp((index + withinSegment) / segmentCount, METER_MIN, METER_MAX);
}

export interface TemperatureBar {
  start: number;
  end: number;
}

function findTemperatureRange(
  daily: readonly DailyForecastEntry[],
): { lowest: number; highest: number } | null {
  const lowest = minBy(daily, (day) => day.temperatureMin)?.temperatureMin;
  const highest = maxBy(daily, (day) => day.temperatureMax)?.temperatureMax;
  return lowest == null || highest == null ? null : { lowest, highest };
}

/** 예보 기간 전체의 최저~최고를 0~1로 두고 하루의 최저·최고가 놓일 위치를 구한다. */
export function toTemperatureBars(daily: readonly DailyForecastEntry[]): TemperatureBar[] {
  const range = findTemperatureRange(daily);
  if (range == null) {
    return [];
  }
  return daily.map((day) => ({
    start: toUnitPosition(day.temperatureMin, range.lowest, range.highest),
    end: toUnitPosition(day.temperatureMax, range.lowest, range.highest),
  }));
}

/** 예보 기간 전체의 최저~최고를 0~1로 두고 지금 기온이 놓일 위치. 예보가 없으면 null이다. */
export function toTemperaturePosition(
  daily: readonly DailyForecastEntry[],
  celsius: number,
): number | null {
  const range = findTemperatureRange(daily);
  return range == null ? null : toUnitPosition(celsius, range.lowest, range.highest);
}
