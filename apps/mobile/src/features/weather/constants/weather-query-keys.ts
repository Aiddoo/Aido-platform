export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  forecast: ({ date, locationRevision }: { date: string; locationRevision: number }) =>
    [...WEATHER_QUERY_KEYS.all, 'forecast', { date, locationRevision }] as const,
  conditions: ({ locationRevision }: { locationRevision: number }) =>
    [...WEATHER_QUERY_KEYS.all, 'conditions', { locationRevision }] as const,
  reports: () => [...WEATHER_QUERY_KEYS.all, 'report'] as const,
  report: ({ locationRevision }: { locationRevision: string }) =>
    [...WEATHER_QUERY_KEYS.reports(), { locationRevision }] as const,
  location: () => [...WEATHER_QUERY_KEYS.all, 'location'] as const,
} as const;
