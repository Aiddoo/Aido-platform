import { maxBy, minBy } from 'es-toolkit';

import { type DailyForecastEntry, toUnitPosition } from './weather-report.model';

/** 예보 기간 전체의 최저~최고를 0~1로 두고 지금 기온이 놓일 위치. 예보가 없으면 null이다. */
function getTemperaturePosition(
  daily: readonly DailyForecastEntry[],
  celsius: number,
): number | null {
  const lowest = minBy(daily, (day) => day.temperatureMin)?.temperatureMin;
  const highest = maxBy(daily, (day) => day.temperatureMax)?.temperatureMax;
  if (lowest == null || highest == null) {
    return null;
  }
  return toUnitPosition(celsius, lowest, highest);
}

export const WeatherDailyPolicy = {
  temperaturePosition: getTemperaturePosition,
} as const;
