export const PREFERENCE_MUTATION_KEYS = {
  all: ['preference', 'mutation'] as const,
  /** 설정 캐시를 낙관적으로 고치는 뮤테이션 전부 */
  writes: () => [...PREFERENCE_MUTATION_KEYS.all, 'write'] as const,
} as const;
