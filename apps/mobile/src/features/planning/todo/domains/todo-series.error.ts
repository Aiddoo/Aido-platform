import { ErrorCode } from '@aido/api/errors';
import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import { isApiError } from '@src/shared/errors';
import { match, P } from 'ts-pattern';

export type TodoSeriesFailure =
  | 'not-found'
  | 'limit'
  | 'no-dates'
  | 'not-repeating'
  | 'invalid'
  | 'too-many-past'
  | 'category-full'
  | 'ended';

export function findTodoSeriesFailure(error: unknown): TodoSeriesFailure | null {
  if (!isApiError(error)) {
    return null;
  }
  return (
    match(error.code)
      .returnType<TodoSeriesFailure | null>()
      .with(ErrorCode.TODO_0841, () => 'not-found')
      .with(ErrorCode.TODO_0842, () => 'limit')
      .with(ErrorCode.TODO_0843, () => 'no-dates')
      .with(ErrorCode.TODO_0844, () => 'not-repeating')
      .with(ErrorCode.TODO_0845, () =>
        error.details?.field === 'startDate' ? 'too-many-past' : 'invalid',
      )
      // 이후 회차까지 옮길 때 대상 카테고리가 가득 찬 경우도 여기로 온다
      .with(ErrorCode.TODO_0811, () => 'category-full')
      .with(ErrorCode.TODO_0846, () => 'ended')
      .with(P.string, () => null)
      .exhaustive()
  );
}

// 한도가 상세에 없는 옛 서버 응답은 공유 상한으로 안내한다
export function getTodoSeriesLimit(error: unknown): number {
  const limit = isApiError(error) ? error.details?.limit : null;
  return typeof limit === 'number' && Number.isInteger(limit) && limit > 0
    ? limit
    : TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER;
}

export function shouldReopenRepeatPicker(error: unknown): boolean {
  const failure = findTodoSeriesFailure(error);
  return failure === 'no-dates' || failure === 'invalid' || failure === 'too-many-past';
}

export function shouldRefreshTodos(failure: TodoSeriesFailure): boolean {
  return failure === 'not-found' || failure === 'not-repeating' || failure === 'ended';
}
