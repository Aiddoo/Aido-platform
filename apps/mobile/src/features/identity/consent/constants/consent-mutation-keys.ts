export const CONSENT_MUTATION_KEYS = {
  /** 동의 캐시를 낙관적으로 고치는 뮤테이션 전부 */
  writes: () => ['consent', 'write'] as const,
  aiDataSharing: () => [...CONSENT_MUTATION_KEYS.writes(), 'ai-data-sharing'] as const,
  marketing: () => [...CONSENT_MUTATION_KEYS.writes(), 'marketing'] as const,
  marketingPush: () => [...CONSENT_MUTATION_KEYS.writes(), 'marketing-push'] as const,
} as const;
