import { isSemanticVersionAtLeast } from "@aido/api";
import { AI_DATA_SHARING_CONSENT, type AiDataSharingDecision } from "@aido/api/vocabulary";

/**
 * 사용자 데이터를 AI 공급자로 보내도 되는지.
 *
 * 동의 화면이 있는 1.13.0 이상 앱을 쓰면 현재 안내에 동의(AGREED)했을 때만 보낸다.
 * 그보다 오래된 앱은 동의를 받을 화면이 없으므로 거부·철회(DECLINED)하지 않았다면 기존처럼 보낸다.
 *
 * - 사용자가 요청한 AI 정리: 요청 헤더의 앱 버전
 * - 예약 작업(리포트 요약·반복 제안): 사용자가 쓰는 기기 중 가장 높은 앱 버전. 알 수 없으면 오래된 앱으로 본다
 */
export function canShareWithAi(
  decision: AiDataSharingDecision,
  appVersion: string | null | undefined,
): boolean {
  if (isSemanticVersionAtLeast(appVersion, AI_DATA_SHARING_CONSENT.MIN_APP_VERSION)) {
    return decision === "AGREED";
  }
  return decision !== "DECLINED";
}
