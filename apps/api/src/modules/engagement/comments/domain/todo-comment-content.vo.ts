import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

export class TodoCommentContent extends ValueObject<string> {
  static create(raw: string): TodoCommentContent {
    const normalized = raw.trim();
    const isWithinLimit =
      normalized.length > 0 && normalized.length <= TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH;
    if (!isWithinLimit) {
      throw new DomainException(ErrorCode.SYS_0002, {
        contentLength: normalized.length,
        maxLength: TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH,
      });
    }
    return new TodoCommentContent(normalized);
  }

  static reconstitute(raw: string): TodoCommentContent {
    return new TodoCommentContent(raw);
  }
}
