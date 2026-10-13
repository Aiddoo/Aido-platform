export const ACHIEVEMENT_QUERY_KEYS = {
  all: ['achievement'] as const,
  weeklyList: (year: number) => [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly', year] as const,
  weeklyDetail: (year: number, week: number) =>
    [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly', year, week] as const,
} as const;
