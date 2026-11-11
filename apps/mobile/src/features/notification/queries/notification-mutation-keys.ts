export const NOTIFICATION_MUTATION_KEYS = {
  /** 알림함(목록·안 읽은 수)을 낙관적으로 읽음 처리하는 뮤테이션 전부 */
  writes: () => ['notification', 'write'] as const,
} as const;
