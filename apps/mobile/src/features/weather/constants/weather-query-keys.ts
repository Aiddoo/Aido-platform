export const WEATHER_QUERY_KEYS = {
  all: ['weather'] as const,
  reports: () => [...WEATHER_QUERY_KEYS.all, 'report'] as const,
  report: ({ locationRevision }: { locationRevision: number }) =>
    [...WEATHER_QUERY_KEYS.reports(), { locationRevision }] as const,
  location: () => [...WEATHER_QUERY_KEYS.all, 'location'] as const,
} as const;
