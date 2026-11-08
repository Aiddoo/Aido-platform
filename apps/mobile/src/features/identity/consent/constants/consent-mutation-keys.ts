export const CONSENT_MUTATION_KEYS = {
  writes: () => ['consent', 'write'] as const,
  aiDataSharing: () => [...CONSENT_MUTATION_KEYS.writes(), 'ai-data-sharing'] as const,
  marketing: () => [...CONSENT_MUTATION_KEYS.writes(), 'marketing'] as const,
  marketingPush: () => [...CONSENT_MUTATION_KEYS.writes(), 'marketing-push'] as const,
} as const;
