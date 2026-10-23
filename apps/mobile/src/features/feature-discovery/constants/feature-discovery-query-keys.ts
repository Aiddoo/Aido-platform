export const FEATURE_DISCOVERY_QUERY_KEYS = {
  all: ['feature-discovery'] as const,
  config: () => [...FEATURE_DISCOVERY_QUERY_KEYS.all, 'config'] as const,
} as const;
