import type { AiDataSharingDecision } from "@aido/api/vocabulary";

import type { UserConsentRecord } from "../../records/settings/user-consent.record.js";

type AiDataSharingConsentState = Pick<
  UserConsentRecord,
  "aiDataSharingAgreedAt" | "aiDataSharingVersion"
>;

/**
 * 현재 안내 버전 기준 동의 상태.
 *
 * 이전 버전에 동의했으면 새 안내에 다시 답해야 하므로 UNDECIDED다. 거부·철회는 안내 버전과
 * 상관없이 유지해 버전을 올려도 사용자가 거부한 처리를 다시 시작하지 않는다.
 */
export function resolveAiDataSharingDecision(
  consent: AiDataSharingConsentState | null,
  currentVersion: string,
): AiDataSharingDecision {
  if (consent?.aiDataSharingVersion == null) {
    return "UNDECIDED";
  }
  if (consent.aiDataSharingAgreedAt == null) {
    return "DECLINED";
  }
  return consent.aiDataSharingVersion === currentVersion ? "AGREED" : "UNDECIDED";
}

export function resolveAiDataSharingAgreement(agreed: boolean, at: Date): Date | null {
  return agreed ? new Date(at) : null;
}
