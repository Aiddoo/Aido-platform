import { useLocalSearchParams } from 'expo-router';

import { weatherDevParamsSchema } from '../schemas/weather-dev-params.schema';
import type { DevWeatherOverride } from '../utils/weather-dev-override';

/** 개발 빌드 QA용: `/weather?devScene=HAIL&devNight=1`로 연 날씨 화면에서만 지금 날씨를 바꿔 보여 준다. */
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
