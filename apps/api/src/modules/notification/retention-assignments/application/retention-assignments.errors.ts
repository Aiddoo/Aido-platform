import type { RetentionStageName } from "../domain/retention-assignments.constants.js";

// 단계와 문구 변형 조합은 결정 함수가 정한다. 다른 조합이 오면 코드가 어긋난 것이다
export function invalidRetentionNotificationSelection(
  stage: RetentionStageName,
  variantId: string,
): Error {
  return new Error(`Invalid retention notification selection: ${stage}:${variantId}`);
}
