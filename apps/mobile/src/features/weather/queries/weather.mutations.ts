import { useHaptics, useWeatherService } from '@src/bootstrap/providers/di-context';
import { useUpdateTodoScheduleMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { getUserFacingMessage, unwrap } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { type Coordinates } from '../domains/weather-location.model';
import { invalidateWeatherReports, setRegisteredWeatherLocation } from './weather-cache';

/** 서버에 위치가 없다고 응답했을 때(WEATHER_1902) 마지막으로 읽은 위치를 다시 등록한다. */
export function useUpdateWeatherLocationMutationOptions() {
  const weatherService = useWeatherService();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const haptics = useHaptics();

  return mutationOptions({
    networkMode: 'always',
    mutationFn: async (coordinates: Coordinates) =>
      unwrap(await weatherService.updateLocation(coordinates)),
    onSuccess: (registered) => {
      setRegisteredWeatherLocation(queryClient, registered);
      return invalidateWeatherReports(queryClient);
    },
    onError: (error) => {
      haptics.notify('error');
      toast.error(getUserFacingMessage(error), {
        fallback: t('weather:toasts.locationUpdateFailed'),
      });
    },
  });
}

/** 할 일 일정 수정 요청만 그대로 쓴다 */
export function useRescheduleTodoMutationOptions() {
  const { mutationFn } = useUpdateTodoScheduleMutationOptions();

  return mutationOptions({ networkMode: 'always', mutationFn });
}
