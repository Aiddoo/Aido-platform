import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function commentContentLengthOutOfRange(contentLength: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    contentLength,
    maxLength: TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH,
  });
}

export function commentChangeForbidden(commentId: string): DomainException {
  return new DomainException(ErrorCode.TODO_0832, { commentId });
}

export function commentDeleted(commentId: string): DomainException {
  return new DomainException(ErrorCode.TODO_0833, { commentId });
}

export function invalidReplyCount(commentId: string): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { commentId });
}

/** 0에서 더 뺄 수 없다. 함께 바뀐 요청이 먼저 수를 줄였다 */
export function commentCountConflict(commentId: string): DomainException {
  return new DomainException(ErrorCode.SYS_0003, { commentId });
}

/** 답글 수는 묶음 머리 댓글만 가진다 */
export function commentNotThreadHead(commentId: string): DomainException {
  return new DomainException(ErrorCode.SYS_0003, { commentId });
}
