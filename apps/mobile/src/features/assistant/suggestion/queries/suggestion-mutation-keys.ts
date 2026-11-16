export const SUGGESTION_MUTATION_KEYS = {
  all: ['suggestion', 'mutation'] as const,
  requestAnalysis: () => [...SUGGESTION_MUTATION_KEYS.all, 'request-analysis'] as const,
} as const;
