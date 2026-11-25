import { queryOptions } from '@tanstack/react-query';

import type { SubscriptionOffering } from '../domains/subscription-offering.model';
import type { StoreUnavailable } from '../domains/subscription.error';

/** 요금제 조회 결과. 스토어를 쓸 수 없는 예상한 상태는 던지지 않고 화면이 안내한다 */
export type OfferingsAvailability =
  | { status: 'available'; offering: SubscriptionOffering }
  | { status: 'unavailable'; unavailable: StoreUnavailable };

export const SUBSCRIPTION_QUERY_KEYS = {
  all: ['subscription'] as const,
  offerings: () =>
    queryOptions<OfferingsAvailability>({
      queryKey: [...SUBSCRIPTION_QUERY_KEYS.all, 'offerings'],
    }).queryKey,
} as const;
