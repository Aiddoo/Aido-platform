/** 웹훅이 서버에 도착·처리될 때까지 대기하는 시간 (ms) */
export const WEBHOOK_SYNC_DELAY = 3_000;

export const SUBSCRIPTION_QUERY_KEYS = {
  all: ['subscription'] as const,
  offerings: () => [...SUBSCRIPTION_QUERY_KEYS.all, 'offerings'] as const,
} as const;
