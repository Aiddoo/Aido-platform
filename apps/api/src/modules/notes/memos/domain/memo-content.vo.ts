import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

export class MemoContent extends ValueObject<string> {
  static create(raw: string): MemoContent {
    const isWithinLimit = 1 <= raw.length && raw.length <= MEMO_LIMITS.MAX_CONTENT_LENGTH;
    if (!isWithinLimit) {
      throw new DomainException(ErrorCode.SYS_0002, { field: "content", length: raw.length });
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
