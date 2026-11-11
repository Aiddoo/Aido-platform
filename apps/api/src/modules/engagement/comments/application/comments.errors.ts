import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function todoNotFound(todoId: number): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0801, { todoId });
}

export function commentNotFound(commentId: string): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0831, { commentId });
}

/** 누가 차단했는지는 오류에 담지 않는다 */
export function blockedCounterpart(): ApplicationException {
  return new ApplicationException(ErrorCode.BLOCK_2204);
}

/** 잘못된 cursor·요청과 같은 멱등 키를 다른 요청에 쓴 경우 */
export function invalidCommentRequest(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002);
}

/** 저장된 수·관계가 기대와 달라 지금 상태로는 처리할 수 없다 */
export function commentStateConflict(commentId?: string): ApplicationException {
  return new ApplicationException(
    ErrorCode.SYS_0003,
    commentId == null ? undefined : { commentId },
  );
}

/** 같은 멱등 키가 원래 요청과 다른 명령에 쓰였다 */
export class TodoCommentIdempotencyConflict extends Error {
  constructor() {
    super();
    this.name = TodoCommentIdempotencyConflict.name;
  }
}

/** 다른 요청과 동시에 같은 멱등 키로 저장해 DB 유니크 제약에서 승패가 갈렸다 */
export class TodoCommentIdempotencyRace extends Error {
  constructor() {
    super();
    this.name = TodoCommentIdempotencyRace.name;
  }
}
