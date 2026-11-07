import { ErrorCode } from '@aido/api/errors';
import type { CodedError } from '@src/core/errors/result';
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
  | 'ended'
  | 'not-created';

/**
 * 반복 생성 응답에 규칙이 없다. 옛 서버(롤백 중)는 repeat를 모르고 단일 할 일 하나만 만들고 201을 준다.
 * 성공으로 처리하면 사용자는 반복이 만들어진 줄 안다.
 */
export class TodoSeriesNotCreatedError extends Error implements CodedError {
  override readonly name = 'TodoSeriesNotCreatedError';
  readonly code = 'TODO_SERIES_NOT_CREATED';

  constructor() {
    super('Server created a single to-do instead of a repeating one');
  }
}

export function getTodoSeriesFailure(error: unknown): TodoSeriesFailure | null {
  if (error instanceof TodoSeriesNotCreatedError) {
    return 'not-created';
  }
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

export function shouldReopenRepeatPicker(error: unknown): boolean {
  const failure = getTodoSeriesFailure(error);
  return failure === 'no-dates' || failure === 'invalid' || failure === 'too-many-past';
}

export function shouldRefreshTodos(failure: TodoSeriesFailure): boolean {
  return (
    failure === 'not-found' ||
    failure === 'not-repeating' ||
    failure === 'ended' ||
    failure === 'not-created'
  );
}

/** 규칙 없음. 옛 서버(롤백 중)에는 이 경로가 없어 404 SYS_0002로 온다 */
export function isTodoSeriesNotFoundError(error: unknown): boolean {
  return (
    getTodoSeriesFailure(error) === 'not-found' ||
    (isApiError(error) && error.status === 404 && error.hasCode(ErrorCode.SYS_0002))
  );
}
