import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { weatherRescheduleParamsSchema } from '../schemas/weather-reschedule-params.schema';

type WeatherRescheduleParams = z.output<typeof weatherRescheduleParamsSchema>;

/** 옮기기 시트 URL의 할 일 id 목록과 이유를 읽고, 시트 안에서 고른 목록을 URL에 되돌려 쓴다. */
export function useWeatherRescheduleParams() {
  const { todoIds, reason } = weatherRescheduleParamsSchema.parse(useLocalSearchParams());
  const setTodoIds = useCallback(
    (next: WeatherRescheduleParams['todoIds']) =>
      router.setParams(
        z.encode(weatherRescheduleParamsSchema.pick({ todoIds: true }), { todoIds: next }),
      ),
    [],
  );

  return { todoIds, reason, setTodoIds };
}
