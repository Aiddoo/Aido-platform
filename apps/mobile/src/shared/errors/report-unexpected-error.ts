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

/** 호출부가 더 붙이는 태그. 기기 작업의 이름(`method`)과 클라이언트가 판단한 사유(`errorCode`)다 */
type UnexpectedErrorTags = Pick<ErrorReporterContext, 'method' | 'errorCode'>;

/** 예상하지 못한 오류만 Sentry 이슈로 보내고, 예상한 오류·연결 문제는 보내지 않는다 */
export function reportUnexpectedError(
  errorReporter: Pick<ErrorReporter, 'captureException'>,
  error: unknown,
  feature: ErrorReportFeature,
  tags: UnexpectedErrorTags = {},
): void {
  if (classifyError(error).report !== 'event') {
    return;
  }
  errorReporter.captureException(toError(error), {
    feature,
    ...getErrorReportTags(error),
    ...tags,
  });
}
