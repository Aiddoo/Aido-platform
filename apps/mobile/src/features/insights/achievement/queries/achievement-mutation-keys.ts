export const ACHIEVEMENT_MUTATION_KEYS = {
  all: ['achievement', 'mutation'] as const,
  shareCertificate: () => [...ACHIEVEMENT_MUTATION_KEYS.all, 'share-certificate'] as const,
} as const;
