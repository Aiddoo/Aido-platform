export const WHATS_NEW_QUERY_KEYS = {
  all: ['feature-discovery'] as const,
  config: () => [...WHATS_NEW_QUERY_KEYS.all, 'config'] as const,
} as const;
