import {
  AiDataSharingConsent,
  type AiDataSharingConsentStatus,
} from "./ai-data-sharing-consent.entity.js";
import type { UserConsentRecord } from "./user-consent.constants.js";

type AiDataSharingConsentState = Pick<
  UserConsentRecord,
  "aiDataSharingAgreedAt" | "aiDataSharingVersion"
>;

/** 저장 행의 동의 상태. 판정 규칙은 AiDataSharingConsent 한 곳이다 */
export function resolveAiDataSharingConsent(
  consent: AiDataSharingConsentState | null,
): AiDataSharingConsentStatus {
  return AiDataSharingConsent.statusOf({
    hasAgreed: consent?.aiDataSharingAgreedAt != null,
    version: consent?.aiDataSharingVersion ?? null,
  });
}

export function resolveAiDataSharingAgreement(
  agreed: boolean,
  at: Temporal.Instant,
): Temporal.Instant | null {
  return agreed ? at : null;
}

export type { AiDataSharingConsentStatus };
