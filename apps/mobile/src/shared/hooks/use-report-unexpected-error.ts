import type { SentryFeature } from '@src/core/observability/telemetry-keys';
import { useErrorReporter } from '@src/shared/di/shared-di-context';
import { isBusinessError, isConnectivityError, toError } from '@src/shared/errors';

/**
 * 저장 실패는 mutation이 토스트로 알리고 화면은 입력값을 지킨다. 오류 경계로 보내지 않는 대신
 * 경계가 하던 보고만 남긴다. 예상한 거절과 연결 문제는 보고할 일이 아니다.
 */
export function useReportUnexpectedError(feature: SentryFeature) {
  const errorReporter = useErrorReporter();

  return (error: unknown) => {
    if (!isBusinessError(error) && !isConnectivityError(error)) {
      errorReporter.captureException(toError(error), { feature });
    }
  };
}
