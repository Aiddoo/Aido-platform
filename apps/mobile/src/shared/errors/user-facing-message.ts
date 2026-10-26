import { isInfraError, ParseError } from './infra-error';
import { isBusinessError } from './result';

/**
 * 오류를 그대로 사용자에게 보여 줄 수 있으면 그 메시지를 돌려준다.
 *
 * 서버·도메인 BusinessError와 번역된 통신 오류(네트워크·타임아웃·5xx)만 사용자 문구다.
 * `ParseError`는 개발자용 검증 메시지를 담으므로, 그 밖의 Error와 함께 `undefined`를 돌려
 * 호출부가 상황에 맞는 폴백 문구를 쓰게 한다.
 */
export const userFacingMessageOf = (error: unknown): string | undefined => {
  if (error instanceof ParseError) {
    return undefined;
  }
  if (!isBusinessError(error) && !isInfraError(error)) {
    return undefined;
  }

  return error.message.trim() ? error.message : undefined;
};
