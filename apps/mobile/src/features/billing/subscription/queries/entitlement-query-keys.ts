import { queryOptions } from '@tanstack/react-query';

import type { EntitlementSnapshot } from '../domains/entitlement.model';

export const ENTITLEMENT_QUERY_KEYS = {
  all: ['entitlement'] as const,
  snapshot: () =>
    queryOptions<EntitlementSnapshot>({ queryKey: [...ENTITLEMENT_QUERY_KEYS.all, 'snapshot'] })
      .queryKey,
} as const;
