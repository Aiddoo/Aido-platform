import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

const TODO_TITLE_MAX_LENGTH = 200;

export class MemoContent {
  private constructor(private readonly _value: string) {}

  static of(value: string): MemoContent {
    if (value.length < 1 || value.length > MEMO_LIMITS.MAX_CONTENT_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, {
        field: "content",
        length: value.length,
      });
    }
    return new MemoContent(value);
  }

  get value(): string {
    return this._value;
  }

  toTodoTitle(): string {
    return this._value.substring(0, TODO_TITLE_MAX_LENGTH);
  }
}
