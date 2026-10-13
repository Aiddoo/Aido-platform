import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { useWeatherSession } from '../components/providers/weather-session-provider';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';

export function getConditionsQueryOptions(
  weatherService: WeatherService,
  { locationRevision }: { locationRevision: number },
) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.conditions({ locationRevision }),
    queryFn: async ({ signal }) => unwrap(await weatherService.getConditions(signal)),
    staleTime: 30 * 60 * 1000,
    retry: (failureCount, error) => !isApiError(error) && failureCount < 2,
  });
}

export function useGetConditionsQueryOptions() {
  const { locationRevision } = useWeatherSession();
  return getConditionsQueryOptions(useWeatherService(), { locationRevision });
}
