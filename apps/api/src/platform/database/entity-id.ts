import { randomBytes } from "node:crypto";

/** 기존 공개 계약의 c 접두사·25자 형식을 유지한다. 시간·프로세스 정보를 ID에 노출하지 않는다. */
export function createEntityId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}
