import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_LIMITS } from "@aido/api/vocabulary";

import { DomainException, ValueObject } from "#api/shared/domain/index";

export class TodoCommentContent extends ValueObject<string> {
  static create(value: string): TodoCommentContent {
    const normalizedContent = value.trim();

    if (
      normalizedContent.length === 0 ||
      normalizedContent.length > TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH
    ) {
      throw new DomainException(ErrorCode.SYS_0002, {
        contentLength: normalizedContent.length,
        maxLength: TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH,
      });
    }

    return new TodoCommentContent(normalizedContent);
  }
}
