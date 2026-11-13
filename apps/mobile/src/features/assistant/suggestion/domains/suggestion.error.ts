import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 프리미엄이 아니면 서버가 제안 목록을 주지 않는다 */
export function isSuggestionsPremiumRequiredError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.AI_1309);
}
