import type { QueryClient } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';

export function refetchWeather(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: WEATHER_QUERY_KEYS.all, type: 'active' });
}
