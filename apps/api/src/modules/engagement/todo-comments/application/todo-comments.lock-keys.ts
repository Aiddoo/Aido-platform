import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../domain/todo-comment-id.vo.js";

// 문자열을 바꾸면 배포가 겹치는 동안 이전 버전과 다른 잠금을 잡으므로 바이트 단위로 유지한다
export const TodoCommentLockKeys = {
  comment: (commentId: TodoCommentId) => `${MUTATION_KEY_PREFIX}:todo-comment:${commentId.value}`,
  request: (authorId: UserId, clientRequestId: string) =>
    `${MUTATION_KEY_PREFIX}:todo-comment-request:${authorId.value}:${clientRequestId}`,
} as const;
