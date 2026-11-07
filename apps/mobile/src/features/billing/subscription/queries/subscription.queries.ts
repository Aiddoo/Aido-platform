import {
  useErrorReporter,
  useLogger,
  useSubscriptionService,
} from '@src/bootstrap/providers/di-context';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';
import { queryOptions } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { SUBSCRIPTION_QUERY_KEYS } from '../constants/subscription-query-keys';
import {
  type OfferingsAvailability,
  type StoreUnavailable,
  toOfferingsAvailability,
  toStoreUnavailableReport,
} from '../utils/offerings-availability';

interface OfferingsObservers {
  errorReporter: ErrorReporter;
  logger: Logger;
}

// 다시 시도·재진입마다 같은 설정 문제를 쌓지 않게 앱 실행마다 코드별로 한 번만 남긴다
const reportedStoreUnavailableCodes = new Set<string>();

function reportStoreUnavailable(
  { kind, diagnosticCode }: StoreUnavailable,
  { errorReporter, logger }: OfferingsObservers,
) {
  if (reportedStoreUnavailableCodes.has(diagnosticCode)) {
    return;
  }
  reportedStoreUnavailableCodes.add(diagnosticCode);

  match(toStoreUnavailableReport(kind, { isDebugBuild: __DEV__ }))
    .with({ channel: 'log' }, () =>
      logger.warn(SUBSCRIPTION_LOG_EVENT.STORE_UNAVAILABLE, { kind, errorCode: diagnosticCode }),
    )
    .with({ channel: 'event' }, ({ severity }) =>
      errorReporter.captureMessage(ERROR_REPORT_MESSAGES.SUBSCRIPTION_STORE_UNAVAILABLE, {
        feature: 'subscription',
        severity,
        errorCode: diagnosticCode,
      }),
    )
    .exhaustive();
}

const OFFERINGS_STALE_TIME = 10 * 60 * 1000;

export function useGetOfferingsQueryOptions() {
  const subscriptionService = useSubscriptionService();
  const observers: OfferingsObservers = { errorReporter: useErrorReporter(), logger: useLogger() };

  return queryOptions({
    queryKey: SUBSCRIPTION_QUERY_KEYS.offerings(),
    queryFn: async (): Promise<OfferingsAvailability> => {
      const availability = toOfferingsAvailability(await subscriptionService.getOfferings());
      if (availability.status === 'unavailable') {
        reportStoreUnavailable(availability.unavailable, observers);
      }
      return availability;
    },
    // 스토어를 쓸 수 없던 결과는 다시 들어오면 새로 확인한다
    staleTime: (query) => (query.state.data?.status === 'available' ? OFFERINGS_STALE_TIME : 0),
  });
}
