import { MEMO_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { memoContentLengthOutOfRange } from "./memos.errors.js";

export class MemoContent extends ValueObject<string> {
  static create(raw: string): MemoContent {
    const isWithinLimit = 1 <= raw.length && raw.length <= MEMO_LIMITS.MAX_CONTENT_LENGTH;
    if (!isWithinLimit) {
      throw memoContentLengthOutOfRange(raw.length);
    }
    return new MemoContent(raw);
  }

  static reconstitute(raw: string): MemoContent {
    return new MemoContent(raw);
  }

  toTodoTitle(): string {
    return this.value.slice(0, TODO_LIMITS.TITLE_MAX_LENGTH);
  }
}
