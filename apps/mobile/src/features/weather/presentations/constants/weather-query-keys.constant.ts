export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  forecast: (date: string) => [...WEATHER_QUERY_KEYS.all, 'forecast', date] as const,
  conditions: () => [...WEATHER_QUERY_KEYS.all, 'conditions'] as const,
} as const;
