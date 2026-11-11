export const SUBSCRIPTION_QUERY_KEYS = {
  all: ['subscription'] as const,
  offerings: () => [...SUBSCRIPTION_QUERY_KEYS.all, 'offerings'] as const,
} as const;
