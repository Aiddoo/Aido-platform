import type { ErrorReportFeature } from '@src/core/observability/telemetry-keys';
import { useErrorReporter } from '@src/shared/di/shared-di-context';
import { reportUnexpectedError } from '@src/shared/errors';

/** mutation 밖의 실패(조회 결과·기기 작업)만 보고한다. mutation 실패는 전역 `meta.errorFeedback`이 보고한다 */
export function useReportUnexpectedError(feature: ErrorReportFeature) {
  const errorReporter = useErrorReporter();

  return (error: unknown) => {
    reportUnexpectedError(errorReporter, error, feature);
  };
}
