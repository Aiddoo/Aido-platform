import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { useWeatherSession } from '../components/providers/weather-session-provider';
import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import type { WeatherForecast } from '../domains/weather.model';
import { toWeatherForecastViewModel } from '../utils/view-models/weather-forecast.view-model';

export function getForecastQueryOptions(
  weatherService: WeatherService,
  { date, locationRevision = 0 }: { date: string; locationRevision?: number },
) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.forecast({ date, locationRevision }),
    queryFn: async ({ signal }) => {
      const result = await weatherService.getForecast(date, signal);
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

export function useGetForecastQueryOptions({ date }: { date: string }) {
  const session = useWeatherSession();
  return queryOptions({
    ...getForecastQueryOptions(useWeatherService(), {
      date,
      locationRevision: session.locationRevision,
    }),
    enabled:
      !session.isSyncing && session.status !== 'checking' && session.status !== 'unsupported',
    select: (forecast: WeatherForecast) => toWeatherForecastViewModel(forecast, session.clock.hour),
  });
}
