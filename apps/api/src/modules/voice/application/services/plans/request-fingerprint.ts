import { createHash } from "node:crypto";

/**
 * 같은 Idempotency-Key가 같은 요청인지 가리는 해시. 말한 내용은 저장하지 않으므로 해시만 남긴다.
 * 사용자 id를 앞에 섞어 짧은 글의 해시를 사용자끼리 비교할 수 없게 한다. value는 요청 schema를 지난 값이라
 * 키 순서가 정해져 있다.
 */
export function fingerprintRequest(userId: string, value: unknown): string {
  return createHash("sha256")
    .update(userId)
    .update("\0")
    .update(JSON.stringify(value))
    .digest("hex");
}
