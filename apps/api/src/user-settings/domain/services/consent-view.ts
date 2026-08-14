import type {
	ConsentResponse,
	UpdateMarketingConsentResponse,
	UpdateMarketingPushConsentResponse,
} from "@aido/validators";

import { toISOStringOrNull } from "@/shared/domain/date/utils/format";

import type { UserConsentRecord } from "../records/user-consent.record";

/** 약관 동의 응답 뷰. 기록이 없으면 전부 null(기존 사용자 호환). */
export function buildConsentView(consent: UserConsentRecord | null): ConsentResponse {
	if (!consent) {
		return {
			termsAgreedAt: null,
			privacyAgreedAt: null,
			agreedTermsVersion: null,
			marketingAgreedAt: null,
			marketingPushAgreedAt: null,
		};
	}

	return {
		termsAgreedAt: toISOStringOrNull(consent.termsAgreedAt),
		privacyAgreedAt: toISOStringOrNull(consent.privacyAgreedAt),
		agreedTermsVersion: consent.agreedTermsVersion,
		marketingAgreedAt: toISOStringOrNull(consent.marketingAgreedAt),
		marketingPushAgreedAt: toISOStringOrNull(consent.marketingPushAgreedAt),
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
