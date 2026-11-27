import { isApiError } from '@src/core/errors/api-error';

import { BusinessError } from './business-error';
import { findErrorCodeMessage } from './error-code-message';
import { isInfraError, ParseError } from './infra-error';

/** ParseError와 SDK 오류(문자열 `code`가 있어도)의 message는 개발용이라 undefined를 돌려 호출부가 폴백 문구를 쓰게 한다 */
export function getUserFacingMessage(error: unknown): string | undefined {
  if (error instanceof ParseError) {
    return undefined;
  }
  if (error instanceof BusinessError) {
    return findErrorCodeMessage(error.code) ?? undefined;
  }
  if (!isApiError(error) && !isInfraError(error)) {
    return undefined;
  }

  return error.message.trim() ? error.message : undefined;
}
