import { randomBytes } from "node:crypto";

import { ENTITY_ID_PATTERN } from "@aido/api/vocabulary";

import { ValueObject } from "./value-object.js";

export abstract class EntityId<TValue extends string | number> extends ValueObject<TValue> {
  override toString(): string {
    return String(this.value);
  }
}

/** 기존 공개 계약의 c 접두사·25자 형식을 유지한다. 시간·프로세스 정보를 ID에 노출하지 않는다 */
export function createEntityId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

/** 서버가 발급한 문자열 엔티티 ID 모양인지. 규칙은 앱 계약과 같은 ENTITY_ID_PATTERN 하나다 */
export function isEntityId(value: unknown): value is string {
  return typeof value === "string" && ENTITY_ID_PATTERN.test(value);
}
