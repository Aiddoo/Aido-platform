export const AUTH_QUERY_KEYS = {
  all: ['auth'] as const,
  me: () => [...AUTH_QUERY_KEYS.all, 'me'] as const,
  preference: () => [...AUTH_QUERY_KEYS.all, 'preference'] as const,
  consent: () => [...AUTH_QUERY_KEYS.all, 'consent'] as const,
} as const;
