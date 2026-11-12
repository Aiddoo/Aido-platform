import { useGetDailyCompletionsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';

import { FORECAST_DAYS } from '../constants/weather.constants';

/** 10일 예보에 할 일 점을 찍을 완료 기록. 화면의 prefetch와 예보 카드가 같은 키를 쓰게 범위를 한 곳에서 정한다 */
export function useForecastCompletionsQueryOptions() {
  const todayKey = useTodayKey();
  return useGetDailyCompletionsQueryOptions({
    startDate: todayKey,
    endDate: addDaysToDateKey(todayKey, FORECAST_DAYS - 1),
  });
}
