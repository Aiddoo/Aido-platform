import {
  AI_DATA_SHARING_CONSENT_VERSIONS,
  type AiDataSharingConsentVersion,
  type AiDataSharingDecision,
} from "@aido/api/vocabulary";

import type { UserConsentRecord } from "../../records/settings/user-consent.record.js";

type AiDataSharingConsentState = Pick<
  UserConsentRecord,
  "aiDataSharingAgreedAt" | "aiDataSharingVersion"
>;

/** 동의 상태와 동의한 안내 버전. agreedVersion은 AGREED일 때만 있다. */
export interface AiDataSharingConsentStatus {
  readonly decision: AiDataSharingDecision;
  readonly agreedVersion: AiDataSharingConsentVersion | null;
}

/**
 * 지원하는 안내 버전 기준 동의 상태.
 *
 * 지원하는 어느 버전에 동의했든 AGREED이고, 그 버전이 허용한 AI 처리 업체만 쓴다(출시 앱 사용자에게 다시 묻지 않음).
 * 지원 목록에 없는 버전 동의는 다시 답해야 하므로 UNDECIDED다. 거부·철회는 버전과 상관없이 유지한다.
 */
export function resolveAiDataSharingConsent(
  consent: AiDataSharingConsentState | null,
): AiDataSharingConsentStatus {
  if (consent?.aiDataSharingVersion == null) {
    return { decision: "UNDECIDED", agreedVersion: null };
  }
  if (consent.aiDataSharingAgreedAt == null) {
    return { decision: "DECLINED", agreedVersion: null };
  }
  const agreedVersion =
    AI_DATA_SHARING_CONSENT_VERSIONS.find((version) => version === consent.aiDataSharingVersion) ??
    null;
  return agreedVersion == null
    ? { decision: "UNDECIDED", agreedVersion: null }
    : { decision: "AGREED", agreedVersion };
}

export function resolveAiDataSharingAgreement(agreed: boolean, at: Date): Date | null {
  return agreed ? new Date(at) : null;
}
