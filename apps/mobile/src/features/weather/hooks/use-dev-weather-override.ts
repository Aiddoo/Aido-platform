import { useLocalSearchParams } from 'expo-router';

import { weatherDevParamsSchema } from '../schemas/weather-dev-params.schema';
import type { WeatherReport } from '../schemas/weather-report.schema';

export type DevWeatherOverride = Pick<WeatherReport['current'], 'condition' | 'isDaylight'>;

/** 개발 빌드 QA용: `/weather?devScene=HAIL&devNight=1`로 연 날씨 화면에서만 지금 날씨를 바꿔 보여 준다. */
function useOverrideFromParams(): DevWeatherOverride | null {
  const parsed = weatherDevParamsSchema.safeParse(useLocalSearchParams());
  if (!parsed.success) {
    return null;
  }
  return { condition: parsed.data.devScene, isDaylight: parsed.data.devNight === '0' };
}

function useNoOverride(): DevWeatherOverride | null {
  return null;
}

/** 운영 번들에서는 `__DEV__`가 false로 치환되어 파라미터를 읽는 코드가 빠진다. */
export const useDevWeatherOverride = __DEV__ ? useOverrideFromParams : useNoOverride;

/** 지금 날씨·시간별 예보(낮밤 포함)·오늘 예보가 모두 같은 날씨로 보이게 바꾼다. 다른 날과 수치는 실제 값을 둔다. */
export function applyDevWeatherOverride(
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
