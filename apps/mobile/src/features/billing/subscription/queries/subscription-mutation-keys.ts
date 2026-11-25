export const SUBSCRIPTION_MUTATION_KEYS = {
  all: ['subscription', 'mutation'] as const,
  purchase: () => [...SUBSCRIPTION_MUTATION_KEYS.all, 'purchase'] as const,
  restore: () => [...SUBSCRIPTION_MUTATION_KEYS.all, 'restore'] as const,
} as const;
