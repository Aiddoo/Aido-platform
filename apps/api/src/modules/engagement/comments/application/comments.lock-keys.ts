import { MUTATION_KEY_PREFIX } from "#api/shared/application/ports/mutation-lock.port";

// 문자열은 옮기기 전 공용 댓글 잠금 키와 같아야 배포 중 옛 버전과 같은 잠금을 잡는다
export const TodoCommentLockKeys = {
  comment: (commentId: string) => `${MUTATION_KEY_PREFIX}:todo-comment:${commentId}`,
  request: (authorId: string, clientRequestId: string) =>
    `${MUTATION_KEY_PREFIX}:todo-comment-request:${authorId}:${clientRequestId}`,
} as const;
