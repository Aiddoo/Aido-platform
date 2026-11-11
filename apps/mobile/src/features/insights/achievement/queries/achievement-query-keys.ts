export const ACHIEVEMENT_QUERY_KEYS = {
  all: ['achievement'] as const,
  weeklyLists: () => [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly-list'] as const,
  weeklyList: ({ year }: { year: number }) =>
    [...ACHIEVEMENT_QUERY_KEYS.weeklyLists(), { year }] as const,
  weeklyDetails: () => [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly-detail'] as const,
  weeklyDetail: ({ year, week }: { year: number; week: number }) =>
    [...ACHIEVEMENT_QUERY_KEYS.weeklyDetails(), { year, week }] as const,
} as const;
