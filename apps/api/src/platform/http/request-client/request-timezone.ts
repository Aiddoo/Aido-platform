import type { RequestClient } from "./request-client.js";

const REQUEST_TIMEZONE_FALLBACK = "UTC";

/**
 * 요청 시간대의 해석 규칙은 이 두 함수뿐이다(docs/conventions/dates.md §2).
 *
 * - 날짜 경계 계산(오늘·주·하루 한도): X-Timezone이 없거나 잘못되면 UTC
 * - 저장값을 쓰거나 덮어쓰는 경로(AI 파싱의 저장 시간대, 푸시 토큰 등록, 자가 치유): 보낸 값만 쓴다
 */
export function requestTimezoneOrUtc(client: Pick<RequestClient, "timezone">): string {
  return client.timezone ?? REQUEST_TIMEZONE_FALLBACK;
}

export function requestTimezoneIfSent(client: Pick<RequestClient, "timezone">): string | undefined {
  return client.timezone ?? undefined;
}
