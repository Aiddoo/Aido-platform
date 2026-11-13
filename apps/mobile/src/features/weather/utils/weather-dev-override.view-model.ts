import type { WeatherReport } from '../domains/weather-report.model';

export type DevWeatherOverride = Pick<WeatherReport['current'], 'condition' | 'isDaylight'>;

/** 지금 날씨·시간별 예보(낮밤 포함)·오늘 예보가 모두 같은 날씨로 보이게 바꾼다. 다른 날과 수치는 실제 값을 둔다. */
export function withDevWeatherOverride(
  report: WeatherReport,
  override: DevWeatherOverride,
): WeatherReport {
  const { condition } = override;
  return {
    ...report,
    current: { ...report.current, ...override },
    hourly: report.hourly.map((hour) => ({ ...hour, ...override })),
    daily: report.daily.map((day, index) =>
      index === 0
        ? {
            ...day,
            condition,
            restOfDay: day.restOfDay == null ? null : { ...day.restOfDay, condition },
          }
        : day,
    ),
  };
}
