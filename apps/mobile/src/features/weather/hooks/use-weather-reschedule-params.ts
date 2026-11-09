import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { weatherRescheduleParamsSchema } from '../schemas/weather-reschedule-params.schema';

/** 옮기기 시트 URL의 할 일 id 목록과 이유를 `[values, setValues]`로 읽고, 시트 안에서 고른 목록을 URL에 되돌려 쓴다. */
export function useWeatherRescheduleParams() {
  return useRouteParams(weatherRescheduleParamsSchema);
}
