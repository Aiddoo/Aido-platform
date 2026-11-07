import { isApiError } from '@src/core/errors/api-error';
import { isBusinessError } from '@src/core/errors/result';
import { ZodError } from 'zod';

import { isConnectivityError, ParseError } from './infra-error';
import { isKeychainLockedError } from './storage-error';

/**
 * Sentry로 보내는 방식.
 *
 * - `event`: 이슈가 된다. 5xx, 파싱 실패, 렌더 오류, 잡지 못한 오류.
 * - `breadcrumb`: 이슈가 되지 않고 이후 이벤트의 행적에만 남는다.
 *   4xx·`BusinessError`·검증 실패·네트워크·타임아웃·키체인 잠금처럼 UI가 처리하거나 기기 상태인 오류.
 */
export type ErrorReportKind = 'event' | 'breadcrumb';

const SERVER_ERROR_STATUS = 500;

/** 오류를 Sentry 이슈로 보낼지 정하는 유일한 곳. 어댑터는 이 판단만 따른다 */
export function classifyErrorReport(error: unknown): ErrorReportKind {
  if (error instanceof ParseError) {
    return 'event';
  }
  if (isApiError(error)) {
    return error.status >= SERVER_ERROR_STATUS ? 'event' : 'breadcrumb';
  }
  if (isBusinessError(error) || error instanceof ZodError) {
    return 'breadcrumb';
  }
  if (isConnectivityError(error) || isKeychainLockedError(error)) {
    return 'breadcrumb';
  }
  return 'event';
}
