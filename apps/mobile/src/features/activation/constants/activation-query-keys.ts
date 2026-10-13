export const ACTIVATION_QUERY_KEYS = {
  all: ['activation'] as const,
  progress: (accountId: string, campaignId: string) =>
    [...ACTIVATION_QUERY_KEYS.all, 'progress', accountId, campaignId] as const,
} as const;
