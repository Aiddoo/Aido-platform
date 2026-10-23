export const PREFERENCE_QUERY_KEYS = {
  all: ['preference'] as const,
  current: () => [...PREFERENCE_QUERY_KEYS.all, 'current'] as const,
} as const;
