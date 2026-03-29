export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  forecast: (date: string) => [...WEATHER_QUERY_KEYS.all, 'forecast', date] as const,
} as const;
