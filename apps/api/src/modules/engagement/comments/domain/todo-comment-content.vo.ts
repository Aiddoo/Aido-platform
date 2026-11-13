import { TODO_COMMENT_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { commentContentLengthOutOfRange } from "./comments.errors.js";

export class TodoCommentContent extends ValueObject<string> {
  static create(raw: string): TodoCommentContent {
    const normalized = raw.trim();
    const isWithinLimit =
      normalized.length > 0 && normalized.length <= TODO_COMMENT_LIMITS.CONTENT_MAX_LENGTH;
    if (!isWithinLimit) {
      throw commentContentLengthOutOfRange(normalized.length);
    }
    return new TodoCommentContent(normalized);
  }

  static reconstitute(raw: string): TodoCommentContent {
    return new TodoCommentContent(raw);
  }
}
