export const USER_MUTATION_KEYS = {
  all: ['user', 'mutation'] as const,
  /** 내 정보 캐시를 낙관적으로 고치는 프로필 저장 */
  updateProfile: () => [...USER_MUTATION_KEYS.all, 'update-profile'] as const,
} as const;
