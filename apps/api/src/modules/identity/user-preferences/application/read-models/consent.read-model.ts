import type { AiDataSharingDecision } from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import { resolveAiDataSharingConsent } from "../../domain/ai-data-sharing-consent.domain-service.js";
import type { UserConsentPrimitives } from "../../domain/user-consent.entity.js";

/** 동의 행 한 줄. 재확인 시각은 재확인 작업만 쓴다 */
export type UserConsentReadModel = UserConsentPrimitives & {
  /** 광고성 수신 동의 사실을 2년마다 다시 알린 마지막 시각. 알린 적 없으면 null */
  readonly marketingReconfirmedAt: Temporal.Instant | null;
};

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
export function buildConsentView(consent: UserConsentReadModel | null): ConsentView {
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
  consent: Pick<UserConsentPrimitives, "aiDataSharingAgreedAt" | "aiDataSharingVersion">,
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
  consent: Pick<UserConsentPrimitives, "marketingPushAgreedAt">,
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
  consent: Pick<UserConsentPrimitives, "marketingAgreedAt">,
  processedAt: Temporal.Instant,
): MarketingConsentView {
  return {
    marketingAgreedAt: toIsoStringOrNull(consent.marketingAgreedAt),
    marketingWithdrawnAt: consent.marketingAgreedAt == null ? toIsoString(processedAt) : null,
  };
}
