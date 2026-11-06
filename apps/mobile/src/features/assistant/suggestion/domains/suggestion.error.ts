import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 프리미엄이 아니면 서버가 제안 목록을 주지 않는다 */
export function isSuggestionsPremiumRequired(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1309);
}

/** 이미 처리했거나 만료돼 사라진 제안이다. 목록을 다시 받아 맞춘다 */
export function isSuggestionUnavailable(error: unknown) {
  return (
    isApiError(error) &&
    (error.hasCode(ErrorCode.AI_1305) ||
      error.hasCode(ErrorCode.AI_1306) ||
      error.hasCode(ErrorCode.AI_1307))
  );
}
