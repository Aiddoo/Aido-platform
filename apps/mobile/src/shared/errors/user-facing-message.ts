import { isCodedError } from '@src/core/errors/result';
import { tDynamic } from '@src/shared/i18n';

import { BusinessError } from './business-error';
import { isInfraError, ParseError } from './infra-error';

/**
 * 오류를 그대로 사용자에게 보여 줄 수 있으면 그 메시지를 돌려준다.
 *
 * 앱 BusinessError는 `errors` 카탈로그의 코드 키로 문구를 고른다. 서버 BusinessError와
 * 번역된 통신 오류(네트워크·타임아웃·5xx)는 담긴 메시지가 사용자 문구다.
 * `ParseError`는 개발자용 검증 메시지를 담으므로, 그 밖의 Error와 함께 `undefined`를 돌려
 * 호출부가 상황에 맞는 폴백 문구를 쓰게 한다.
 */
export function getUserFacingMessage(error: unknown): string | undefined {
  if (error instanceof ParseError) {
    return undefined;
  }
  if (error instanceof BusinessError) {
    return tDynamic('errors', error.code) || undefined;
  }
  if (!isCodedError(error) && !isInfraError(error)) {
    return undefined;
  }

  return error.message.trim() ? error.message : undefined;
}
