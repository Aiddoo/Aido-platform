import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

/** 서버는 지운 할 일과 볼 권한이 없는 할 일을 모두 404로 답한다 */
export function isTodoUnavailableError(error: unknown) {
  return isApiError(error) && error.status === HttpStatus.NOT_FOUND;
}

/** 친구가 끊거나 차단해 친구의 할 일·완료 현황을 더는 볼 수 없다. 다시 시도해도 같아 안내와 내 피드로 가는 길을 보인다 */
export function isFriendFeedUnavailableError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.FOLLOW_0906);
}

/** 카테고리의 활성 할 일이 한도에 닿아 더 만들 수 없다 */
export function isCategoryTodoLimitError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.TODO_0811);
}

/** 반복 할 일을 만들면 카테고리의 할 일 한도를 넘는다 */
export function isRecurringCategoryTodoLimitError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.TODO_0813);
}
