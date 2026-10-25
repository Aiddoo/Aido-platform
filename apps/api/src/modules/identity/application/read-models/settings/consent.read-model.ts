import type {
  ConsentResponse,
  UpdateAiDataSharingConsentResponse,
  UpdateMarketingConsentResponse,
  UpdateMarketingPushConsentResponse,
} from "@aido/api";
import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";

import { toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { UserConsentRecord } from "../../../domain/records/settings/user-consent.record.js";
import { resolveAiDataSharingDecision } from "../../../domain/services/settings/ai-data-sharing-consent-policy.js";

/** 약관 동의 응답 뷰. 기록이 없으면 전부 null(기존 사용자 호환). */
export function buildConsentView(consent: UserConsentRecord | null): ConsentResponse {
  if (consent === null) {
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
    aiDataSharingDecision: resolveAiDataSharingDecision(consent, AI_DATA_SHARING_CONSENT.VERSION),
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
    aiDataSharingDecision: resolveAiDataSharingDecision(consent, AI_DATA_SHARING_CONSENT.VERSION),
    aiDataSharingAgreedAt: toISOStringOrNull(consent.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: answeredVersion,
  };
}

export function buildMarketingPushConsentView(
  consent: UserConsentRecord,
): UpdateMarketingPushConsentResponse {
  return {
    marketingPushAgreedAt: toISOStringOrNull(consent.marketingPushAgreedAt),
  };
}

/** 마케팅 동의 변경 응답 뷰. */
export function buildMarketingConsentView(
  consent: UserConsentRecord,
): UpdateMarketingConsentResponse {
  return {
    marketingAgreedAt: toISOStringOrNull(consent.marketingAgreedAt),
  };
}
