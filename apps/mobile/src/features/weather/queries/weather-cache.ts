import type { QueryClient } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';

export function refetchWeather(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: WEATHER_QUERY_KEYS.all, type: 'active' });
}

export function invalidateWeather(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: WEATHER_QUERY_KEYS.all });
}

export function cancelWeather(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: WEATHER_QUERY_KEYS.all });
}

export function removeWeather(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: WEATHER_QUERY_KEYS.all });
}
