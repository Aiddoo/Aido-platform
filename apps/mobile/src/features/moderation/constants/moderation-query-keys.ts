export const MODERATION_QUERY_KEYS = {
  all: ['moderation'] as const,
  blockedUsers: () => [...MODERATION_QUERY_KEYS.all, 'blocked-users'] as const,
} as const;
