import { useWeatherService } from '@src/bootstrap/providers/di-context';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { isApiError } from '@src/shared/errors/api-error';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import type { WeatherForecast } from '../domains/weather.model';
import { useWeatherSession, type WeatherSession } from '../hooks/weather-session-provider';
import { toWeatherForecastViewModel } from '../utils/view-models/weather-forecast.view-model';

/** 위치를 확인하는 중이거나 국외 위치면 예보를 요청하지 않는다. */
export function isForecastRequestable(session: Pick<WeatherSession, 'isSyncing' | 'status'>) {
  return !session.isSyncing && session.status !== 'checking' && session.status !== 'unsupported';
}

export function getForecastQueryOptions(
  weatherService: WeatherService,
  { date, locationRevision }: { date: string; locationRevision: number },
) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.forecast({ date, locationRevision }),
    queryFn: async ({ signal }) => unwrap(await weatherService.getForecast(date, signal)),
    staleTime: 30 * 60 * 1000,
    retry: (failureCount, error) => !isApiError(error) && failureCount < 2,
  });
}

export function useGetForecastQueryOptions() {
  const { clock, locationRevision } = useWeatherSession();
  const select = useCallback(
    (forecast: WeatherForecast) => toWeatherForecastViewModel(forecast, clock.hour),
    [clock.hour],
  );

  return queryOptions({
    ...getForecastQueryOptions(useWeatherService(), { date: clock.date, locationRevision }),
    select,
  });
}
