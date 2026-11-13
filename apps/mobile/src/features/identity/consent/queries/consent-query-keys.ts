import { queryOptions } from '@tanstack/react-query';

import type { Consent } from '../domains/consent.model';

export const CONSENT_QUERY_KEYS = {
  all: ['consent'] as const,
  detail: () => queryOptions<Consent>({ queryKey: [...CONSENT_QUERY_KEYS.all, 'detail'] }).queryKey,
} as const;
