import { ErrorCode } from '@aido/api/errors';
import { isApiError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

/** 반복 할 일 요청이 거절된 이유. 이유마다 다음 행동이 다르다 */
export type TodoSeriesFailure =
  | 'not-found'
  | 'limit'
  | 'no-dates'
  | 'not-repeating'
  | 'invalid'
  | 'ended';

export function getTodoSeriesFailure(error: unknown): TodoSeriesFailure | null {
  if (!isApiError(error)) {
    return null;
  }
  return match(error.code)
    .returnType<TodoSeriesFailure | null>()
    .with(ErrorCode.TODO_0841, () => 'not-found')
    .with(ErrorCode.TODO_0842, () => 'limit')
    .with(ErrorCode.TODO_0843, () => 'no-dates')
    .with(ErrorCode.TODO_0844, () => 'not-repeating')
    .with(ErrorCode.TODO_0845, () => 'invalid')
    .with(ErrorCode.TODO_0846, () => 'ended')
    .with(P.string, () => null)
    .exhaustive();
}

/** 반복 설정을 다시 고르면 풀리는 거절. 시트를 다시 연다 */
export function shouldReopenRepeatPicker(error: unknown): boolean {
  const failure = getTodoSeriesFailure(error);
  return failure === 'no-dates' || failure === 'invalid';
}

/** 앱이 알던 반복 상태가 서버와 달라진 거절. 목록을 새로 불러온다 */
export function shouldRefreshTodos(failure: TodoSeriesFailure): boolean {
  return failure === 'not-found' || failure === 'not-repeating' || failure === 'ended';
}

export function isTodoSeriesNotFoundError(error: unknown): boolean {
  return getTodoSeriesFailure(error) === 'not-found';
}
