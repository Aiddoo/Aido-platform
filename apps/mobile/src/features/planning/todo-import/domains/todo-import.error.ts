import {
  ErrorCode,
  HttpStatus,
  todoImportInvalidErrorDetailsSchema,
  todoImportReferenceErrorDetailsSchema,
  todoImportTargetsRejectedErrorDetailsSchema,
} from '@aido/api/errors';
import type { TodoImportTargetRejectionReason } from '@aido/api/vocabulary';
import { type ApiError, isApiError } from '@src/core/errors/api-error';
import { isTransientError } from '@src/shared/errors';
import { isMatching, match, P } from 'ts-pattern';

/** 자리 부족이면 지금 수·가져올 수·한도가 함께 온다 */
export interface TodoImportTargetRejection {
  targetKey: string;
  reason: TodoImportTargetRejectionReason;
  current?: number;
  expected?: number;
  limit?: number;
}

/** 자리 부족으로 거절된 카테고리에 더 넣을 수 있는 수. 서버가 수를 주지 않으면 0이다 */
export function calculateRemainingCapacity(rejection: TodoImportTargetRejection) {
  return Math.max((rejection.limit ?? 0) - (rejection.current ?? 0), 0);
}

/** 다른 기기·앞선 시도로 이미 처리 중인 가져오기 */
export function findActiveTodoImportId(error: unknown): string | null {
  if (!isApiError(error) || !error.hasCode(ErrorCode.TODO_IMPORT_2301)) {
    return null;
  }
  const details = todoImportReferenceErrorDetailsSchema.safeParse(error.details);
  return details.success ? details.data.importId : null;
}

export function findRejectedTargets(error: unknown): TodoImportTargetRejection[] {
  if (!isApiError(error) || !error.hasCode(ErrorCode.TODO_IMPORT_2303)) {
    return [];
  }
  const details = todoImportTargetsRejectedErrorDetailsSchema.safeParse(error.details);
  return details.success ? details.data.targets : [];
}

/** 이어 보낼 것이 없어 기기 상태를 지운다 */
export function isTodoImportNotFoundError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.TODO_IMPORT_2304);
}

/** 서버 상태가 진실이라 기기 상태를 지운다 */
export function isTodoImportStatusConflictError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.TODO_IMPORT_2305);
}

/** 기기 자정과 서버 자정이 어긋나 기간 첫날이 서버의 오늘 이전이다 */
export function isStartBeforeTodayError(error: unknown) {
  if (!isApiError(error) || !error.hasCode(ErrorCode.TODO_IMPORT_2306)) {
    return false;
  }
  return isMatching(
    { reason: 'START_BEFORE_TODAY' },
    todoImportInvalidErrorDetailsSchema.safeParse(error.details).data,
  );
}

/** 429도 기다렸다 다시 보내면 풀린다 */
export function isRetryableTodoImportError(error: unknown) {
  return (
    isTransientError(error) || (isApiError(error) && error.status === HttpStatus.TOO_MANY_REQUESTS)
  );
}

export function findRetryAfterMs(error: unknown): number | null {
  return isApiError(error) ? error.retryAfterMs : null;
}

/** 기다려도 풀리지 않는 거절(4xx). 업로드를 멈추고 이유를 이 기기 화면에 보인다 */
export function findTodoImportRejection(error: unknown): ApiError | null {
  return isApiError(error) && !isRetryableTodoImportError(error) ? error : null;
}

/** 시작 화면이 칸·이동·한도 안내로 보여 전역 토스트를 띄우지 않는다 */
export function isTodoImportStartHandledError(error: unknown) {
  return isMatching(
    {
      code: P.union(
        ErrorCode.TODO_IMPORT_2301,
        ErrorCode.TODO_IMPORT_2302,
        ErrorCode.TODO_IMPORT_2303,
        ErrorCode.TODO_CATEGORY_0857,
      ),
    },
    isApiError(error) ? error : null,
  );
}

export type TodoImportUploadFailure =
  | 'TOO_MANY_ITEMS'
  | 'INVALID'
  | 'PLAN_LIMIT'
  | 'CATEGORY_LIMIT'
  | 'CATEGORY_NAME_TAKEN'
  | 'CATEGORY_NOT_FOUND'
  | 'REJECTED';

/**
 * 올리거나 확정하다 서버가 받지 않은 이유. 세션이 남긴 거절로 고른다.
 * 카테고리 자리 부족(CAPACITY)은 서버가 더는 거절하지 않고 건너뛰지만, 오면 일반 거절로 본다
 */
export function getTodoImportUploadFailure(error: unknown): TodoImportUploadFailure {
  if (!isApiError(error)) {
    return 'REJECTED';
  }
  const [rejectedTarget] = findRejectedTargets(error);
  return match(error.code)
    .returnType<TodoImportUploadFailure>()
    .with(ErrorCode.TODO_IMPORT_2309, () => 'TOO_MANY_ITEMS')
    .with(ErrorCode.TODO_IMPORT_2306, () => 'INVALID')
    .with(ErrorCode.TODO_IMPORT_2302, () => 'PLAN_LIMIT')
    .with(ErrorCode.TODO_CATEGORY_0857, () => 'CATEGORY_LIMIT')
    .with(ErrorCode.TODO_IMPORT_2303, () =>
      match(rejectedTarget?.reason)
        .returnType<TodoImportUploadFailure>()
        .with('CATEGORY_NAME_TAKEN', () => 'CATEGORY_NAME_TAKEN')
        .with('CATEGORY_NOT_FOUND', () => 'CATEGORY_NOT_FOUND')
        .with(P.union('CAPACITY', undefined), () => 'REJECTED')
        .exhaustive(),
    )
    .otherwise(() => 'REJECTED');
}
