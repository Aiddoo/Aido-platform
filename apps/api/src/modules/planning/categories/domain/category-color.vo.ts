import { hexColorRegex } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { invalidCategoryColor } from "./categories.errors.js";

// 계약(zod)과 같은 정규식이라 유효한 요청은 통과한다. 도메인 경계에서도 한 번 더 막는다
export class CategoryColor extends ValueObject<string> {
  static create(raw: string): CategoryColor {
    if (!hexColorRegex.test(raw)) {
      throw invalidCategoryColor();
    }
    return new CategoryColor(raw);
  }

  static reconstitute(raw: string): CategoryColor {
    return new CategoryColor(raw);
  }
}
