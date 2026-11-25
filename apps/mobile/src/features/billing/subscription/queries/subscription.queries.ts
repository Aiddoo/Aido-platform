import { useSubscriptionService } from '@src/bootstrap/providers/di-context';
import type { Result } from '@src/core/errors/result';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { queryOptions } from '@tanstack/react-query';

import type { SubscriptionOffering } from '../domains/subscription-offering.model';
import {
  findStoreUnavailableKind,
  getSubscriptionDiagnosticCode,
  type SubscriptionError,
} from '../domains/subscription.error';
import { type OfferingsAvailability, SUBSCRIPTION_QUERY_KEYS } from './subscription-query-keys';

const OFFERINGS_STALE_TIME_MS = 10 * MINUTE_MS;

/** 스토어를 쓸 수 없는 상태는 화면이 안내하고, 그 밖의 실패는 오류 경계로 던진다 */
export function toOfferingsAvailability(
  result: Result<SubscriptionOffering, SubscriptionError>,
): OfferingsAvailability {
  if (result.ok) {
    return { status: 'available', offering: result.value };
  }

  const kind = findStoreUnavailableKind(result.error);
  if (kind == null) {
    throw result.error;
  }
  return {
    status: 'unavailable',
    unavailable: { kind, diagnosticCode: getSubscriptionDiagnosticCode(result.error) },
  };
}

export function useGetOfferingsQueryOptions() {
  const subscriptionService = useSubscriptionService();
  return queryOptions({
    queryKey: SUBSCRIPTION_QUERY_KEYS.offerings(),
    queryFn: async (): Promise<OfferingsAvailability> =>
      toOfferingsAvailability(await subscriptionService.getOfferings()),
    // 스토어를 쓸 수 없던 결과는 다시 들어오면 새로 확인한다
    staleTime: (query) => (query.state.data?.status === 'available' ? OFFERINGS_STALE_TIME_MS : 0),
  });
}
