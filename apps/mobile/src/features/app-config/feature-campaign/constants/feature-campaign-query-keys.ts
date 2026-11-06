export const FEATURE_CAMPAIGN_QUERY_KEYS = {
  all: ['feature-discovery'] as const,
  config: () => [...FEATURE_CAMPAIGN_QUERY_KEYS.all, 'config'] as const,
} as const;
