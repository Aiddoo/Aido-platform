import { useWeatherService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys.constant';
import { toWeatherForecastViewModel } from '../view-models/weather-forecast.view-model';

export const useGetForecastQueryOptions = (date: string) => {
  const weatherService = useWeatherService();

  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.forecast(date),
    queryFn: async () => {
      const result = await weatherService.getForecast(date);
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
};
