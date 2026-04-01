import type { UpdateLocationInput } from '@aido/validators';
import { useWeatherService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys.constant';

export const useUpdateLocationMutationOptions = () => {
  const weatherService = useWeatherService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: UpdateLocationInput) => {
      const result = await weatherService.updateLocation(input);
      return unwrap(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.all });
    },
    onError: (error) => {
      if (isApiError(error)) {
        toast.error(error, { fallback: '위치 등록에 실패했어요' });
        return;
      }
    },
  });
};
