import { TODO_CATEGORY_LIMITS } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { categoryNameLengthOutOfRange } from "./todo-categories.errors.js";

export class CategoryName extends ValueObject<string> {
  static create(raw: string): CategoryName {
    if (raw.length < 1 || raw.length > TODO_CATEGORY_LIMITS.NAME_MAX_LENGTH) {
      throw categoryNameLengthOutOfRange(TODO_CATEGORY_LIMITS.NAME_MAX_LENGTH);
    }
    return new CategoryName(raw);
  }

  static reconstitute(raw: string): CategoryName {
    return new CategoryName(raw);
  }
}
