import { queryOptions } from '@tanstack/react-query';

import type { EntitlementSnapshot } from '../domains/entitlement.model';

export const ENTITLEMENT_QUERY_KEYS = {
  all: ['entitlements'] as const,
  snapshot: () =>
    queryOptions<EntitlementSnapshot>({ queryKey: [...ENTITLEMENT_QUERY_KEYS.all] }).queryKey,
} as const;
