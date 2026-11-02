import { useWeatherService } from '@src/bootstrap/providers/di-context';
import { isApiError, unwrap } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import type { Coordinates } from '../domains/weather-location.model';
import { invalidateWeatherReports, setRegisteredWeatherLocation } from './weather-cache';

/** 서버에 위치가 없다고 응답했을 때(WEATHER_1902) 마지막으로 읽은 위치를 다시 등록한다. */
export const useUpdateWeatherLocationMutationOptions = () => {
  const weatherService = useWeatherService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (coordinates: Coordinates) =>
      unwrap(await weatherService.registerLocation(coordinates)),
    onSuccess: (registered) => {
      setRegisteredWeatherLocation(queryClient, registered);
      return invalidateWeatherReports(queryClient);
    },
    onError: (error) => {
      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('weather:toasts.locationUpdateFailed') });
    },
  });
};
