export const MODERATION_MUTATION_KEYS = {
  all: ['moderation', 'mutation'] as const,
  blockUser: () => [...MODERATION_MUTATION_KEYS.all, 'block-user'] as const,
  unblockUser: () => [...MODERATION_MUTATION_KEYS.all, 'unblock-user'] as const,
  reportContent: () => [...MODERATION_MUTATION_KEYS.all, 'report-content'] as const,
} as const;
