import type {
  ConsentResponse,
  UpdateAiDataSharingConsentResponse,
  UpdateMarketingConsentResponse,
  UpdateMarketingPushConsentResponse,
} from "@aido/api";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import { resolveAiDataSharingConsent } from "../../domain/ai-data-sharing-consent.domain-service.js";
import type { UserConsentRecord } from "../../domain/user-consent.constants.js";

/** 약관 동의 응답 뷰. 기록이 없으면 전부 null(기존 사용자 호환). */
export function buildConsentView(consent: UserConsentRecord | null): ConsentResponse {
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
    termsAgreedAt: toISOStringOrNull(consent.termsAgreedAt),
    privacyAgreedAt: toISOStringOrNull(consent.privacyAgreedAt),
    agreedTermsVersion: consent.agreedTermsVersion,
    marketingAgreedAt: toISOStringOrNull(consent.marketingAgreedAt),
    marketingPushAgreedAt: toISOStringOrNull(consent.marketingPushAgreedAt),
    aiDataSharingDecision: resolveAiDataSharingConsent(consent).decision,
    aiDataSharingAgreedAt: toISOStringOrNull(consent.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: consent.aiDataSharingVersion,
  };
}

/** AI 데이터 처리 동의 변경 응답 뷰. 방금 답한 안내 버전을 그대로 돌려준다. */
export function buildAiDataSharingConsentView(
  consent: UserConsentRecord,
  answeredVersion: string,
): UpdateAiDataSharingConsentResponse {
  return {
    aiDataSharingDecision: resolveAiDataSharingConsent(consent).decision,
    aiDataSharingAgreedAt: toISOStringOrNull(consent.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: answeredVersion,
  };
}

/** 광고성 앱 푸시 동의 변경 응답 뷰. 철회면 처리한 서버 시각을 함께 준다. */
export function buildMarketingPushConsentView(
  consent: UserConsentRecord,
  processedAt: Date,
): UpdateMarketingPushConsentResponse {
  return {
    marketingPushAgreedAt: toISOStringOrNull(consent.marketingPushAgreedAt),
    marketingPushWithdrawnAt:
      consent.marketingPushAgreedAt == null ? toISOStringOrNull(processedAt) : null,
  };
}

/** 마케팅 동의 변경 응답 뷰. 철회면 처리한 서버 시각을 함께 준다. */
export function buildMarketingConsentView(
  consent: UserConsentRecord,
  processedAt: Date,
): UpdateMarketingConsentResponse {
  return {
    marketingAgreedAt: toISOStringOrNull(consent.marketingAgreedAt),
    marketingWithdrawnAt: consent.marketingAgreedAt == null ? toISOStringOrNull(processedAt) : null,
  };
}
