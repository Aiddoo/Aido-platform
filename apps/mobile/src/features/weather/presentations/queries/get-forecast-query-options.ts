import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/services/weather.service';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys.constant';
import { toWeatherForecastViewModel } from '../view-models/weather-forecast.view-model';

export function getForecastQueryOptions(
  weatherService: WeatherService,
  { date }: { date: string },
) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.forecast(date),
    queryFn: async ({ signal }) => {
      const result = await weatherService.getForecast(date, signal);
      return unwrap(result);
    },
    select: (forecast) => toWeatherForecastViewModel(forecast, new Date().getHours()),
    staleTime: 30 * 60 * 1000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useGetForecastQueryOptions(date: string) {
  return getForecastQueryOptions(useWeatherService(), { date });
}
