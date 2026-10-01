import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/services/weather.service';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys.constant';

export function getConditionsQueryOptions(weatherService: WeatherService) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.conditions(),
    queryFn: async ({ signal }) => {
      const result = await weatherService.getConditions(signal);
      return unwrap(result);
    },
    staleTime: 30 * 60 * 1000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useGetConditionsQueryOptions() {
  return getConditionsQueryOptions(useWeatherService());
}
