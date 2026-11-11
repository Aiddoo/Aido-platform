import { isApiError } from '@src/core/errors/api-error';
import { isCodedError } from '@src/core/errors/result';
import type { ErrorReporterContext } from '@src/core/ports/error-reporter';
import { ZodError } from 'zod';

import { isConnectivityError, isInfraError, ParseError, ServerError } from './infra-error';
import { isKeychainLockedError } from './storage-error';

/** event는 이슈가 되고 breadcrumb은 행적에만 남는다(4xx·BusinessError·검증 실패·네트워크·타임아웃·키체인 잠금) */
export type ErrorReportKind = 'event' | 'breadcrumb';

// oxlint-disable-next-line aido/http-status-literal -- 1.15.2 전환 #1400
const SERVER_ERROR_STATUS = 500;

/** 오류를 Sentry 이슈로 보낼지 정하는 유일한 곳. 어댑터는 이 판단만 따른다 */
export function classifyErrorReport(error: unknown): ErrorReportKind {
  if (error instanceof ParseError) {
    return 'event';
  }
  if (isApiError(error)) {
    return error.status >= SERVER_ERROR_STATUS ? 'event' : 'breadcrumb';
  }
  if (isCodedError(error) || error instanceof ZodError) {
    return 'breadcrumb';
  }
  if (isConnectivityError(error) || isKeychainLockedError(error)) {
    return 'breadcrumb';
  }
  return 'event';
}

/**
 * 사용자 안내로 끝나지 않는 실패. 문자열 `code`를 지닌 오류(서버 `ApiError`, 앱 `BusinessError`, 코드가 있는 SDK 오류)와
 * 연결 문제는 보고하지 않는다. 그래서 SDK 오류는 어댑터가 코드 없는 포트 오류로 바꿔야 보고된다
 */
export function isUnexpectedError(error: unknown): boolean {
  return !isCodedError(error) && !isConnectivityError(error);
}

type ErrorReportTags = Pick<ErrorReporterContext, 'statusCode' | 'method' | 'endpoint'>;

/** 오류가 지닌 요청 정보. 어느 API의 실패인지 보고에 태그로 남긴다 */
export function getErrorReportTags(error: unknown): ErrorReportTags {
  if (error instanceof ServerError) {
    return { statusCode: error.statusCode, ...error.request };
  }
  if (isInfraError(error) && error.statusCode != null) {
    return { statusCode: error.statusCode };
  }
  return {};
}
