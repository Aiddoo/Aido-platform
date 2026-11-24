import {
  ErrorCode,
  HttpStatus,
  todoImportInvalidErrorDetailsSchema,
  todoImportReferenceErrorDetailsSchema,
  todoImportTargetsRejectedErrorDetailsSchema,
} from '@aido/api/errors';
import type { TodoImportTargetRejectionReason } from '@aido/api/vocabulary';
import { isApiError } from '@src/core/errors/api-error';
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

export function findTodoImportRejectionCode(error: unknown): string | null {
  return isApiError(error) && !isRetryableTodoImportError(error) ? error.code : null;
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

export type TodoImportUploadFailure = 'TOO_MANY_ITEMS' | 'INVALID' | 'REJECTED';

/** 업로드 중 서버가 받지 않은 이유. 세션이 남긴 오류 코드로 고른다 */
export function getTodoImportUploadFailure(code: string): TodoImportUploadFailure {
  return match(code)
    .returnType<TodoImportUploadFailure>()
    .with(ErrorCode.TODO_IMPORT_2309, () => 'TOO_MANY_ITEMS')
    .with(ErrorCode.TODO_IMPORT_2306, () => 'INVALID')
    .otherwise(() => 'REJECTED');
}
