import type { ErrorReportFeature } from '@src/core/observability/telemetry-keys';
import { useErrorReporter } from '@src/shared/di/shared-di-context';
import { reportUnexpectedError } from '@src/shared/errors';

/** mutation·조회 밖의 실패(기기 작업, 조회 결과로 하는 일)만 보고한다. mutation은 `meta.errorFeedback`, 조회는 경계·전역 조회 캐시가 보고한다 */
export function useReportUnexpectedError(feature: ErrorReportFeature) {
  const errorReporter = useErrorReporter();

  return (error: unknown) => {
    reportUnexpectedError(errorReporter, error, feature);
  };
}
