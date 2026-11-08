import type { ErrorReportFeature } from '@src/core/observability/telemetry-keys';
import { useErrorReporter } from '@src/shared/di/shared-di-context';
import { isCodedError, isConnectivityError, toError } from '@src/shared/errors';

/** 저장 실패는 mutation이 토스트로 알리므로 경계가 하던 보고만 남긴다. 예상한 거절과 연결 문제는 보고하지 않는다 */
export function useReportUnexpectedError(feature: ErrorReportFeature) {
  const errorReporter = useErrorReporter();

  return (error: unknown) => {
    if (!isCodedError(error) && !isConnectivityError(error)) {
      errorReporter.captureException(toError(error), { feature });
    }
  };
}
