import { useLocalSearchParams } from 'expo-router';

import type { WeatherReport } from '../domains/weather-report.model';
import { weatherDevParamsSchema } from '../schemas/weather-dev-params.schema';

export type DevWeatherOverride = Pick<WeatherReport['current'], 'condition' | 'isDaylight'>;

function useRouteOverride() {
  const parsed = weatherDevParamsSchema.safeParse(useLocalSearchParams());
  const override: DevWeatherOverride | null = parsed.success
    ? { condition: parsed.data.devScene, isDaylight: parsed.data.devNight === '0' }
    : null;

  return [override] as const;
}

function useNoOverride() {
  const override: DevWeatherOverride | null = null;

  return [override] as const;
}

/** 운영 번들에서는 `__DEV__`가 false로 치환되어 파라미터를 읽는 코드가 빠진다. */
export const useDevWeatherOverride = __DEV__ ? useRouteOverride : useNoOverride;

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
