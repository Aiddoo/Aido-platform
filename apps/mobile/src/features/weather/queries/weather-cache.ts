import type { QueryClient } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import type { LocationReading, RegisteredLocation } from '../domains/weather-location.model';

export function refetchWeather(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: WEATHER_QUERY_KEYS.all, type: 'active' });
}

export function invalidateWeather(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.all });
}

export function refetchWeatherLocation(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: WEATHER_QUERY_KEYS.location() });
}

export function invalidateWeatherReports(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.reports() });
}

/** 다시 등록한 위치를 위치 캐시에 반영한다. 위치를 읽기 전이면 다음 위치 확인에서 채운다. */
export function setRegisteredWeatherLocation(
  queryClient: QueryClient,
  registered: RegisteredLocation,
) {
  queryClient.setQueryData<LocationReading>(WEATHER_QUERY_KEYS.location(), (reading) =>
    reading?.status === 'located' ? { ...reading, registered } : reading,
  );
}
