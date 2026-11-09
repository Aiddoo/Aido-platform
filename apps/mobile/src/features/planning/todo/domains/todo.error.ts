import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';

const NOT_FOUND_STATUS = 404;

/** 서버는 지운 할 일과 볼 권한이 없는 할 일을 모두 404로 답한다 */
export function isTodoUnavailableError(error: unknown) {
  return isApiError(error) && error.status === NOT_FOUND_STATUS;
}

/** 카테고리의 활성 할 일이 한도에 닿아 더 만들 수 없다 */
export function isCategoryTodoLimitError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.TODO_0811);
}

/** 반복 할 일을 만들면 카테고리의 할 일 한도를 넘는다 */
export function isRecurringCategoryTodoLimitError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.TODO_0813);
}
