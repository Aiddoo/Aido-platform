export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  forecast: (date: string, locationRevision = 0) =>
    [...WEATHER_QUERY_KEYS.all, 'forecast', date, locationRevision] as const,
  conditions: (locationRevision = 0) =>
    [...WEATHER_QUERY_KEYS.all, 'conditions', locationRevision] as const,
} as const;
