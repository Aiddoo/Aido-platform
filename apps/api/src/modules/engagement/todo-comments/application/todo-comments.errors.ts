import { ErrorCode } from "@aido/api/errors";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { ApplicationException } from "#api/shared/application/application.exception";

import type { TodoCommentId } from "../../shared/domain/todo-comment-id.vo.js";

export function todoNotFound(todoId: TodoId): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0801, { todoId: todoId.value });
}

export function commentNotFound(commentId: TodoCommentId): ApplicationException {
  return new ApplicationException(ErrorCode.TODO_0831, { commentId: commentId.value });
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
export function commentStateConflict(commentId?: TodoCommentId): ApplicationException {
  return new ApplicationException(
    ErrorCode.SYS_0003,
    commentId == null ? undefined : { commentId: commentId.value },
  );
}

/** 같은 멱등 키가 원래 요청과 다른 명령에 쓰였다. HTTP로 나가기 전에 SYS_0002로 바꾼다 */
export class TodoCommentIdempotencyConflictError extends Error {
  constructor() {
    super("Todo comment idempotency key was reused for another request");
    this.name = TodoCommentIdempotencyConflictError.name;
  }
}

export function todoCommentIdempotencyConflict(): TodoCommentIdempotencyConflictError {
  return new TodoCommentIdempotencyConflictError();
}

/** 다른 요청과 동시에 같은 멱등 키로 저장해 DB 유니크 제약에서 승패가 갈렸다. 진 쪽은 먼저 쓴 글을 다시 읽는다 */
export class TodoCommentIdempotencyRaceError extends Error {
  constructor() {
    super("Todo comment idempotency key was taken by a concurrent request");
    this.name = TodoCommentIdempotencyRaceError.name;
  }
}

export function todoCommentIdempotencyRace(): TodoCommentIdempotencyRaceError {
  return new TodoCommentIdempotencyRaceError();
}
