export const FRIEND_MUTATION_KEYS = {
  all: ['friend', 'mutation'] as const,
  /** 친구 목록 캐시를 낙관적으로 고치는 뮤테이션 전부 */
  writes: () => [...FRIEND_MUTATION_KEYS.all, 'write'] as const,
  acceptRequest: () => [...FRIEND_MUTATION_KEYS.all, 'accept-request'] as const,
  cancelRequest: () => [...FRIEND_MUTATION_KEYS.all, 'cancel-request'] as const,
  rejectRequest: () => [...FRIEND_MUTATION_KEYS.all, 'reject-request'] as const,
  reorderFriend: () => [...FRIEND_MUTATION_KEYS.all, 'reorder-friend'] as const,
  sendRequestByTag: () => [...FRIEND_MUTATION_KEYS.all, 'send-request-by-tag'] as const,
} as const;
