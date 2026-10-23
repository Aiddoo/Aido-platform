export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  forecast: ({ date, locationRevision }: { date: string; locationRevision: number }) =>
    [...WEATHER_QUERY_KEYS.all, 'forecast', { date, locationRevision }] as const,
  conditions: ({ locationRevision }: { locationRevision: number }) =>
    [...WEATHER_QUERY_KEYS.all, 'conditions', { locationRevision }] as const,
} as const;
