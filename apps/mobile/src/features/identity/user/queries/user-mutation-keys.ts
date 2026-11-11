export const USER_MUTATION_KEYS = {
  /** 내 정보 캐시를 낙관적으로 고치는 프로필 저장 */
  updateProfile: () => ['user', 'update-profile'] as const,
} as const;
