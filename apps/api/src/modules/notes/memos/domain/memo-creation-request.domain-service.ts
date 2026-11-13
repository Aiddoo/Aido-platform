import { createHash } from "node:crypto";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/**
 * 같은 Idempotency-Key가 같은 메모 저장인지 가리는 해시. 글은 메모에 이미 있으므로 비교용 해시만 남긴다.
 * 사용자 id를 앞에 섞어 짧은 글의 해시를 사용자끼리 비교할 수 없게 한다
 */
export function fingerprintMemoCreation(userId: UserId, content: string): string {
  return createHash("sha256").update(userId.value).update("\0").update(content).digest("hex");
}
