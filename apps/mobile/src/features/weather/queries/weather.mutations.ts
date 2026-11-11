import { useWeatherApi } from '@src/bootstrap/providers/di-context';
import { useUpdateTodoScheduleMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { unwrap } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { type Coordinates } from '../domains/weather-location.model';
import { invalidateWeatherReports, setRegisteredWeatherLocation } from './weather-cache';

/** 서버에 위치가 없다고 응답했을 때(WEATHER_1902) 마지막으로 읽은 위치를 다시 등록한다. */
export function useUpdateWeatherLocationMutationOptions() {
  const weatherApi = useWeatherApi();
  const queryClient = useQueryClient();

  return mutationOptions({
    // 등록 버튼이 응답까지 돈다. 오프라인에 멈춰 두면 연결될 때까지 도니 바로 실패해 알린다
    networkMode: 'always',
    mutationFn: async (coordinates: Coordinates) =>
      unwrap(await weatherApi.updateLocation(coordinates)),
    onSuccess: (registered) => {
      setRegisteredWeatherLocation(queryClient, registered);
      return invalidateWeatherReports(queryClient);
    },
    meta: {
      errorFeedback: {
        feature: 'weather_location',
        fallbackKey: 'weather:toasts.locationUpdateFailed',
      },
    },
  });
}

/** 할 일마다의 토스트·무효화는 빼고 호출하는 쪽이 한 번만 한다. 오프라인에 멈추면 시트가 닫히지 않아 바로 실패한다 */
export function useRescheduleTodoMutationOptions() {
  const { mutationFn } = useUpdateTodoScheduleMutationOptions();

  return mutationOptions({ networkMode: 'always', mutationFn, meta: { errorFeedback: false } });
}
