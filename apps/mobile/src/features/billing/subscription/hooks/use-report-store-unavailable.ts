import { useErrorReporter, useLogger } from '@src/bootstrap/providers/di-context';
import { ERROR_REPORT_MESSAGES } from '@src/core/observability/telemetry-keys';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { match } from 'ts-pattern';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import {
  type StoreUnavailable,
  toStoreUnavailableReport,
} from '../utils/offerings-availability.view-model';

// 다시 시도·재진입마다 같은 설정 문제를 쌓지 않게 앱 실행마다 코드별로 한 번만 남긴다(보고자별로 센다)
const reportedStoreUnavailableCodes = new WeakMap<ErrorReporter, Set<string>>();

/** 스토어를 쓸 수 없다는 안내를 보였을 때 남길 신호. 배포는 Sentry 메시지, 개발은 로그다 */
export function useReportStoreUnavailable() {
  const errorReporter = useErrorReporter();
  const logger = useLogger();

  return ({ kind, diagnosticCode }: StoreUnavailable) => {
    const reportedCodes = reportedStoreUnavailableCodes.get(errorReporter) ?? new Set<string>();
    if (reportedCodes.has(diagnosticCode)) {
      return;
    }
    reportedCodes.add(diagnosticCode);
    reportedStoreUnavailableCodes.set(errorReporter, reportedCodes);

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
  };
}
