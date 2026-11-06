export const USER_QUERY_KEYS = {
  all: ['user'] as const,
  me: () => [...USER_QUERY_KEYS.all, 'me'] as const,
} as const;
