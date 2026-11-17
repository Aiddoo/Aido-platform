import {
  AiDataSharingConsent,
  type AiDataSharingConsentStatus,
} from "./ai-data-sharing-consent.entity.js";
import type { UserConsentPrimitives } from "./user-consent.entity.js";

type AiDataSharingConsentState = Pick<
  UserConsentPrimitives,
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
