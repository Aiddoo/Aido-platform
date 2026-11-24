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
import { isMatching, P } from 'ts-pattern';

/** 서버가 거절한 대상 하나. 자리 부족이면 지금 수·가져올 수·한도가 함께 온다 */
export interface TodoImportTargetRejection {
  targetKey: string;
  reason: TodoImportTargetRejectionReason;
  current?: number;
  expected?: number;
  limit?: number;
}

/** 이미 처리 중인 가져오기가 있다(다른 기기·앞선 시도). 그 가져오기 id. 아니면 null */
export function findActiveTodoImportId(error: unknown): string | null {
  if (!isApiError(error) || !error.hasCode(ErrorCode.TODO_IMPORT_2301)) {
    return null;
  }
  const details = todoImportReferenceErrorDetailsSchema.safeParse(error.details);
  return details.success ? details.data.importId : null;
}

/** 서버가 거절한 대상 카테고리(자리 부족·이름 겹침·없음). 아니면 빈 목록 */
export function findRejectedTargets(error: unknown): TodoImportTargetRejection[] {
  if (!isApiError(error) || !error.hasCode(ErrorCode.TODO_IMPORT_2303)) {
    return [];
  }
  const details = todoImportTargetsRejectedErrorDetailsSchema.safeParse(error.details);
  return details.success ? details.data.targets : [];
}

/** 없거나 남의 가져오기다. 이어 보낼 것이 없어 기기 상태를 지운다 */
export function isTodoImportNotFoundError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.TODO_IMPORT_2304);
}

/** 그 사이 상태가 바뀌어(확정·취소·정리) 이 요청을 받을 수 없다. 서버 상태가 진실이라 기기 상태를 지운다 */
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

/** 연결·시간 초과·5xx와 요청 속도 제한(429)은 기다렸다 다시 보내면 풀린다 */
export function isRetryableTodoImportError(error: unknown) {
  return (
    isTransientError(error) || (isApiError(error) && error.status === HttpStatus.TOO_MANY_REQUESTS)
  );
}

/** 서버가 `Retry-After`로 알려 준 대기 시간. 없으면 null */
export function findRetryAfterMs(error: unknown): number | null {
  return isApiError(error) ? error.retryAfterMs : null;
}

/** 서버가 코드로 거절한 요청(4xx)의 코드. 그 밖의 오류는 null */
export function findTodoImportRejectionCode(error: unknown): string | null {
  return isApiError(error) && !isRetryableTodoImportError(error) ? error.code : null;
}

/** 시작 화면이 칸·이동·한도 안내로 직접 보이는 오류. 전역 토스트를 띄우지 않는다 */
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
