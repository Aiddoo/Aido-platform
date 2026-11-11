export const FRIEND_MUTATION_KEYS = {
  all: ['friend', 'mutation'] as const,
  /** 친구 목록 캐시를 낙관적으로 고치는 뮤테이션 전부 */
  writes: () => [...FRIEND_MUTATION_KEYS.all, 'write'] as const,
} as const;
