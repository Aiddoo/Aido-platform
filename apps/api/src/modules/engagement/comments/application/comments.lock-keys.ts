import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";

// 문자열을 바꾸면 배포가 겹치는 동안 이전 버전과 다른 잠금을 잡으므로 바이트 단위로 유지한다
export const TodoCommentLockKeys = {
  comment: (commentId: string) => `${MUTATION_KEY_PREFIX}:todo-comment:${commentId}`,
  request: (authorId: string, clientRequestId: string) =>
    `${MUTATION_KEY_PREFIX}:todo-comment-request:${authorId}:${clientRequestId}`,
} as const;
