export const ACHIEVEMENT_QUERY_KEYS = {
  all: ['achievement'] as const,
  weeklyList: (year: number) => [...ACHIEVEMENT_QUERY_KEYS.all, 'weekly', year] as const,
} as const;
