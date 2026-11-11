import { ENTITY_ID_PATTERN } from "@aido/api/vocabulary";

import { ValueObject } from "./value-object.js";

export abstract class EntityId<TValue extends string | number> extends ValueObject<TValue> {
  override toString(): string {
    return String(this.value);
  }
}

/** 서버가 발급한 문자열 엔티티 ID 모양인지. 규칙은 앱 계약과 같은 ENTITY_ID_PATTERN 하나다 */
export function isEntityId(value: unknown): value is string {
  return typeof value === "string" && ENTITY_ID_PATTERN.test(value);
}
