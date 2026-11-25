import { useWeatherApi } from '@src/bootstrap/providers/di-context';
import { useUpdateTodoScheduleMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { unwrap } from '@src/shared/errors';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { type Coordinates } from '../domains/location-reading.model';
import { invalidateWeatherReports, setWeatherLocationInCache } from './weather-cache';
import { WEATHER_MUTATION_KEYS } from './weather-mutation-keys';

/** 서버에 위치가 없다고 응답했을 때(WEATHER_1902) 마지막으로 읽은 위치를 다시 등록한다. */
export function useUpdateWeatherLocationMutationOptions() {
  const weatherApi = useWeatherApi();
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationKey: WEATHER_MUTATION_KEYS.updateWeatherLocation(),
    // 등록 버튼이 응답까지 돈다. 오프라인에 멈춰 두면 연결될 때까지 도니 바로 실패해 알린다
    networkMode: 'always',
    mutationFn: async (coordinates: Coordinates) =>
      unwrap(await weatherApi.updateLocation(coordinates)),
    onSuccess: (registered) => {
      setWeatherLocationInCache(queryClient, registered);
    },
    // 응답을 놓친 실패도 서버에는 위치가 바뀌었을 수 있다
    onSettled: () => invalidateWeatherReports(queryClient),
    meta: {
      errorFeedback: {
        feature: 'weather_location',
        fallbackKey: 'weather:toasts.locationUpdateFailed',
      },
    },
  });
}

/**
 * 할 일마다의 토스트·무효화는 빼고 호출하는 쪽이 한 번만 한다. 오프라인에 멈추면 시트가 닫히지 않아 바로 실패한다.
 * 할 일 쓰기 묶음 키는 남겨 옮기는 동안 끝난 체크가 다시 받아 옮긴 값을 덮지 않게 한다
 */
export function useRescheduleTodoMutationOptions() {
  const { mutationKey, mutationFn: updateTodoSchedule } = useUpdateTodoScheduleMutationOptions();

  return mutationOptions({
    networkMode: 'always',
    mutationKey,
    mutationFn: updateTodoSchedule,
    meta: { errorFeedback: false },
  });
}
