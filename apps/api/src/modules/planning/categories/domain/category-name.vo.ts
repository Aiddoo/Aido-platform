import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { ValueObject } from "#api/shared/domain/model/value-object";

// DB VarChar(50)·계약과 같은 상한이다
const MAX_LENGTH = 50;

export class CategoryName extends ValueObject<string> {
  static create(raw: string): CategoryName {
    if (raw.length < 1 || raw.length > MAX_LENGTH) {
      throw new DomainException(ErrorCode.SYS_0002, { maxLength: MAX_LENGTH });
    }
    return new CategoryName(raw);
  }

  static reconstitute(raw: string): CategoryName {
    return new CategoryName(raw);
  }
}
