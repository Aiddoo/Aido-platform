import { HttpStatus } from '@aido/api/errors';
import { isApiError } from '@src/core/errors/api-error';

import { BusinessError } from './business-error';
import { isConnectivityError } from './infra-error';
import { isKeychainLockedError } from './storage-error';

/**
 * - `expected`: 서버(4xx)나 앱(`BusinessError`)이 이유를 정해 거절했거나 기기가 잠겨 지금 읽지 못한다. 화면이 안내한다
 * - `auth-expired`: 401. 세션이 끝나 곧 로그인 화면으로 바뀐다
 * - `connectivity`: 연결이 끊겼거나 응답이 오지 않았다. 기기 상태다
 * - `unexpected`: 5xx, 응답 계약 위반(`ParseError`·`ZodError`), 코드 버그, 감싸지 않은 SDK 오류. 고칠 대상이다
 */
export type ErrorKind = 'expected' | 'auth-expired' | 'connectivity' | 'unexpected';

/** `event`는 Sentry 이슈가 되고 `breadcrumb`은 다음 이슈의 행적에만 남는다 */
type ErrorReport = 'event' | 'breadcrumb';

interface ErrorClassification {
  kind: ErrorKind;
  report: ErrorReport;
}

function getErrorKind(error: unknown): ErrorKind {
  if (isApiError(error)) {
    return error.status === HttpStatus.UNAUTHORIZED ? 'auth-expired' : 'expected';
  }
  if (error instanceof BusinessError || isKeychainLockedError(error)) {
    return 'expected';
  }
  if (isConnectivityError(error)) {
    return 'connectivity';
  }
  return 'unexpected';
}

/**
 * 오류를 나누는 유일한 곳. Sentry 어댑터, mutation·조회 전역 보고, 경계가 모두 이 판정을 따른다.
 * 예상한 오류만 이름으로 나열하고 나머지는 모두 예상하지 못한 오류다(문자열 `code`가 있는 SDK 오류도)
 */
export function classifyError(error: unknown): ErrorClassification {
  const kind = getErrorKind(error);
  return { kind, report: kind === 'unexpected' ? 'event' : 'breadcrumb' };
}
