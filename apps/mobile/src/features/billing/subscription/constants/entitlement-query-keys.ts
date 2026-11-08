import { queryOptions } from '@tanstack/react-query';

import type { EntitlementSnapshot } from '../domains/entitlement.model';

export const ENTITLEMENT_QUERY_KEYS = {
  all: ['entitlements'] as const,
  // 캐시를 직접 읽고 쓰는 키는 데이터 타입을 붙여 getQueryData·setQueryData가 타입을 안다
  snapshot: () =>
    queryOptions<EntitlementSnapshot>({ queryKey: [...ENTITLEMENT_QUERY_KEYS.all] }).queryKey,
} as const;
