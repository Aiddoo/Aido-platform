import type { AiDataSharingDecision } from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import { resolveAiDataSharingConsent } from "../../domain/ai-data-sharing-consent.domain-service.js";
import type { UserConsentRecord } from "../../domain/user-consent.constants.js";

function toIsoStringOrNull(instant: Temporal.Instant | null): string | null {
  return instant == null ? null : toIsoString(instant);
}

/** 시각은 ISO 문자열이고 기록이 없으면 null이다 */
export interface ConsentView {
  readonly termsAgreedAt: string | null;
  readonly privacyAgreedAt: string | null;
  readonly agreedTermsVersion: string | null;
  readonly marketingAgreedAt: string | null;
  readonly marketingPushAgreedAt: string | null;
  readonly aiDataSharingDecision: AiDataSharingDecision;
  readonly aiDataSharingAgreedAt: string | null;
  readonly aiDataSharingConsentVersion: string | null;
}

export interface AiDataSharingConsentView {
  readonly aiDataSharingDecision: AiDataSharingDecision;
  readonly aiDataSharingAgreedAt: string | null;
  readonly aiDataSharingConsentVersion: string;
}

export interface MarketingConsentView {
  readonly marketingAgreedAt: string | null;
  readonly marketingWithdrawnAt: string | null;
}

export interface MarketingPushConsentView {
  readonly marketingPushAgreedAt: string | null;
  readonly marketingPushWithdrawnAt: string | null;
}

/** 약관 동의 응답 뷰. 기록이 없으면 전부 null(기존 사용자 호환). */
export function buildConsentView(consent: UserConsentRecord | null): ConsentView {
  if (consent == null) {
    return {
      termsAgreedAt: null,
      privacyAgreedAt: null,
      agreedTermsVersion: null,
      marketingAgreedAt: null,
      marketingPushAgreedAt: null,
      aiDataSharingDecision: "UNDECIDED",
      aiDataSharingAgreedAt: null,
      aiDataSharingConsentVersion: null,
    };
  }

  return {
    termsAgreedAt: toIsoStringOrNull(consent.termsAgreedAt),
    privacyAgreedAt: toIsoStringOrNull(consent.privacyAgreedAt),
    agreedTermsVersion: consent.agreedTermsVersion,
    marketingAgreedAt: toIsoStringOrNull(consent.marketingAgreedAt),
    marketingPushAgreedAt: toIsoStringOrNull(consent.marketingPushAgreedAt),
    aiDataSharingDecision: resolveAiDataSharingConsent(consent).decision,
    aiDataSharingAgreedAt: toIsoStringOrNull(consent.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: consent.aiDataSharingVersion,
  };
}

/** AI 데이터 처리 동의 변경 응답 뷰. 방금 답한 안내 버전을 그대로 돌려준다. */
export function buildAiDataSharingConsentView(
  consent: UserConsentRecord,
  answeredVersion: string,
): AiDataSharingConsentView {
  return {
    aiDataSharingDecision: resolveAiDataSharingConsent(consent).decision,
    aiDataSharingAgreedAt: toIsoStringOrNull(consent.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: answeredVersion,
  };
}

/** 광고성 앱 푸시 동의 변경 응답 뷰. 철회면 처리한 서버 시각을 함께 준다. */
export function buildMarketingPushConsentView(
  consent: UserConsentRecord,
  processedAt: Temporal.Instant,
): MarketingPushConsentView {
  return {
    marketingPushAgreedAt: toIsoStringOrNull(consent.marketingPushAgreedAt),
    marketingPushWithdrawnAt:
      consent.marketingPushAgreedAt == null ? toIsoString(processedAt) : null,
  };
}

/** 마케팅 동의 변경 응답 뷰. 철회면 처리한 서버 시각을 함께 준다. */
export function buildMarketingConsentView(
  consent: UserConsentRecord,
  processedAt: Temporal.Instant,
): MarketingConsentView {
  return {
    marketingAgreedAt: toIsoStringOrNull(consent.marketingAgreedAt),
    marketingWithdrawnAt: consent.marketingAgreedAt == null ? toIsoString(processedAt) : null,
  };
}
