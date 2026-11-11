import { queryOptions } from '@tanstack/react-query';

import type { OfferingsAvailability } from '../utils/offerings-availability';

export const SUBSCRIPTION_QUERY_KEYS = {
  all: ['subscription'] as const,
  offerings: () =>
    queryOptions<OfferingsAvailability>({
      queryKey: [...SUBSCRIPTION_QUERY_KEYS.all, 'offerings'],
    }).queryKey,
} as const;
