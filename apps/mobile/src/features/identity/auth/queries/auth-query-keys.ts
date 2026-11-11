export const AUTH_QUERY_KEYS = {
  all: ['auth'] as const,
  linkedAccounts: () => [...AUTH_QUERY_KEYS.all, 'linked-accounts'] as const,
} as const;
