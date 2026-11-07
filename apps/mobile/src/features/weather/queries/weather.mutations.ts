import { useWeatherService } from '@src/bootstrap/providers/di-context';
import { useUpdateTodoScheduleMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { unwrap } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { isLocationUpdateRejectedError } from '../domains/weather.error';
import { type Coordinates } from '../schemas/weather-location.schema';
import { invalidateWeatherReports, setRegisteredWeatherLocation } from './weather-cache';

/** 서버에 위치가 없다고 응답했을 때(WEATHER_1902) 마지막으로 읽은 위치를 다시 등록한다. */
export function useUpdateWeatherLocationMutationOptions() {
  const weatherService = useWeatherService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (coordinates: Coordinates) =>
      unwrap(await weatherService.updateLocation(coordinates)),
    onSuccess: (registered) => {
      setRegisteredWeatherLocation(queryClient, registered);
      return invalidateWeatherReports(queryClient);
    },
    onError: (error) => {
      if (isLocationUpdateRejectedError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('weather:toasts.locationUpdateFailed') });
    },
  });
}

/**
 * 할 일 일정 수정 요청만 그대로 쓴다. 여러 할 일을 한 번에 옮기므로 할 일마다 뜨는 저장 토스트·실패 토스트와
 * 캐시 무효화는 빼고, 호출하는 쪽이 한 번만 알리고 한 번만 무효화한다.
 * 오프라인에서 요청이 멈추면 시트가 닫히지 않으므로 바로 실패시킨다.
 */
export function useRescheduleTodoMutationOptions() {
  const { mutationFn } = useUpdateTodoScheduleMutationOptions();

  return mutationOptions({ networkMode: 'always', mutationFn });
}
