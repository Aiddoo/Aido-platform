import { useRouteParams } from '@src/shared/hooks/use-route-params';

import {
  type WeatherRescheduleParams,
  weatherRescheduleParamsSchema,
} from '../schemas/weather-reschedule-params.schema';

/** 옮기기 시트 URL의 할 일 id 목록. 시트 안에서 옮긴 할 일을 빼면 남은 목록을 URL에 되돌려 쓴다 */
export function useWeatherRescheduleTodoIds() {
  const [{ todoIds }, setParams] = useRouteParams(weatherRescheduleParamsSchema);
  const setTodoIds = (next: WeatherRescheduleParams['todoIds']) => setParams({ todoIds: next });

  return [todoIds, setTodoIds] as const;
}

/** 옮기는 이유(비·더위). 링크가 정하고 시트는 바꾸지 않는다 */
export function useWeatherRescheduleReason() {
  const [{ reason }] = useRouteParams(weatherRescheduleParamsSchema);

  return [reason] as const;
}
