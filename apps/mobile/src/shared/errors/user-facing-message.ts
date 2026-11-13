import { isApiError } from '@src/core/errors/api-error';

import { BusinessError } from './business-error';
import { findErrorCodeMessage } from './error-code-message';
import { isInfraError, ParseError } from './infra-error';

/**
 * 사용자 문구가 있는 오류(서버 `ApiError`, 카탈로그에 있는 `BusinessError`, 번역된 통신 오류)만 그 문구를 돌려준다.
 * ParseError와 SDK 오류(문자열 `code`가 있어도)의 message는 개발용이라 undefined를 돌려 호출부가 폴백 문구를 쓰게 한다
 */
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
