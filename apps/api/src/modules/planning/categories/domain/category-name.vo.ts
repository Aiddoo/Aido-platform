import { ValueObject } from "#api/shared/domain/model/value-object";

import { categoryNameLengthOutOfRange } from "./categories.errors.js";

// DB VarChar(50)·계약과 같은 상한이다
const MAX_LENGTH = 50;

export class CategoryName extends ValueObject<string> {
  static create(raw: string): CategoryName {
    if (raw.length < 1 || raw.length > MAX_LENGTH) {
      throw categoryNameLengthOutOfRange(MAX_LENGTH);
    }
    return new CategoryName(raw);
  }

  static reconstitute(raw: string): CategoryName {
    return new CategoryName(raw);
  }
}
