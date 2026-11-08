// 옛 키의 auth 접두어를 영속 캐시와 맞추려고 유지한다
export const CONSENT_QUERY_KEYS = {
  all: ['auth', 'consent'] as const,
  detail: () => [...CONSENT_QUERY_KEYS.all] as const,
} as const;
