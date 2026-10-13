export const AUTH_QUERY_KEYS = {
  all: ['auth'] as const,
  consent: () => [...AUTH_QUERY_KEYS.all, 'consent'] as const,
  linkedAccounts: () => [...AUTH_QUERY_KEYS.all, 'linked-accounts'] as const,
} as const;
