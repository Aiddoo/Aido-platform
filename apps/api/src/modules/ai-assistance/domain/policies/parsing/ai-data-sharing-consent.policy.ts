import { isSemanticVersionAtLeast } from "@aido/api";
import { AI_DATA_SHARING_CONSENT, type AiDataSharingDecision } from "@aido/api/vocabulary";

/**
 * 사용자가 요청한 AI 기능을 처리해도 되는지.
 *
 * 동의 화면이 있는 1.13.0 이상 앱은 현재 안내에 동의해야 한다. 그보다 오래된 앱은 동의를
 * 받을 화면이 없으므로 거부·철회하지 않았다면 기존처럼 처리한다.
 */
export function canProcessRequestedAi(
  decision: AiDataSharingDecision,
  appVersion: string | undefined,
): boolean {
  if (isSemanticVersionAtLeast(appVersion, AI_DATA_SHARING_CONSENT.MIN_APP_VERSION)) {
    return decision === "AGREED";
  }
  return decision !== "DECLINED";
}

/**
 * 리포트 요약·반복 제안처럼 서버가 예약 작업으로 AI를 부를 때. 요청한 앱 버전을 알 수 없으므로
 * 사용자가 명시적으로 거부·철회한 경우에만 AI 없이 처리한다.
 */
export function canProcessScheduledAi(decision: AiDataSharingDecision): boolean {
  return decision !== "DECLINED";
}
