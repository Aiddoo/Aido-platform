import { queryOptions } from '@tanstack/react-query';

import type { Consent } from '../domains/consent.model';

// 'auth' 접두어는 인증 모듈 키 공간을 쓰던 옛 키라 영속 캐시와 맞추려고 그대로 둔다
export const CONSENT_QUERY_KEYS = {
  all: ['auth', 'consent'] as const,
  // 캐시를 직접 읽고 쓰는 키는 데이터 타입을 붙여 getQueryData·setQueryData가 타입을 안다
  detail: () => queryOptions<Consent>({ queryKey: [...CONSENT_QUERY_KEYS.all] }).queryKey,
} as const;
