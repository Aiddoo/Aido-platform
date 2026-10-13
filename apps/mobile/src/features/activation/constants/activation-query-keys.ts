export const ACTIVATION_QUERY_KEYS = {
  all: ['activation'] as const,
  progress: ({ accountId, campaignId }: { accountId: string; campaignId: string }) =>
    [...ACTIVATION_QUERY_KEYS.all, 'progress', { accountId, campaignId }] as const,
  inactive: () => [...ACTIVATION_QUERY_KEYS.all, 'inactive'] as const,
} as const;
