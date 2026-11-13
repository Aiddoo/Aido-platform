import type { ErrorReportFeature } from '@src/core/observability/telemetry-keys';
import type { ErrorReporter, ErrorReporterContext } from '@src/core/ports/error-reporter';

import { classifyError } from './classify-error';
import { ServerError } from './infra-error';
import { toError } from './to-error';

type ErrorReportTags = Pick<
  ErrorReporterContext,
  'statusCode' | 'serverErrorCode' | 'method' | 'endpoint'
>;

/** 오류가 지닌 요청 정보. 어느 API의 어떤 서버 판정인지 보고에 태그로 남긴다 */
export function getErrorReportTags(error: unknown): ErrorReportTags {
  if (error instanceof ServerError) {
    return {
      statusCode: error.status,
      ...(error.serverCode != null && { serverErrorCode: error.serverCode }),
      ...error.request,
    };
  }
  return {};
}

/**
 * 예상하지 못한 오류만 요청 태그와 함께 Sentry 이슈로 보낸다. 예상한 오류·연결 문제는 보내지 않는다.
 * mutation·조회 전역 보고, `useReportUnexpectedError`, 경계가 같은 이 함수를 쓴다
 */
export function reportUnexpectedError(
  errorReporter: Pick<ErrorReporter, 'captureException'>,
  error: unknown,
  feature: ErrorReportFeature,
): void {
  if (classifyError(error).report !== 'event') {
    return;
  }
  errorReporter.captureException(toError(error), { feature, ...getErrorReportTags(error) });
}
