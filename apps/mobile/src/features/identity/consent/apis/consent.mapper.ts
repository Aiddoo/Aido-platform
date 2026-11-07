import type {
  ConsentResponse,
  UpdateAiDataSharingConsentResponse,
  UpdateMarketingConsentResponse,
  UpdateMarketingPushConsentResponse,
} from '@aido/api';
import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { toNullableInstant } from '@src/shared/date/instant';

import type {
  Consent,
  UpdateAiDataSharingConsentResult,
  UpdateMarketingConsentResult,
  UpdateMarketingPushConsentResult,
} from '../schemas/consent.schema';

export function toConsent(dto: ConsentResponse): Consent {
  return {
    termsAgreedAt: toNullableInstant(dto.termsAgreedAt),
    privacyAgreedAt: toNullableInstant(dto.privacyAgreedAt),
    agreedTermsVersion: dto.agreedTermsVersion,
    marketingAgreedAt: toNullableInstant(dto.marketingAgreedAt),
    marketingPushAgreedAt: toNullableInstant(dto.marketingPushAgreedAt),
    // 1.13.0 이전 서버는 AI 동의 필드를 주지 않는다. 답하지 않은 것으로 보고 AI 전에 안내를 띄운다
    aiDataSharingDecision: dto.aiDataSharingDecision ?? AI_DATA_SHARING_DECISION.UNDECIDED,
    aiDataSharingAgreedAt: toNullableInstant(dto.aiDataSharingAgreedAt ?? null),
    aiDataSharingConsentVersion: dto.aiDataSharingConsentVersion ?? null,
  };
}

export function toUpdateMarketingConsentResult(
  dto: UpdateMarketingConsentResponse,
): UpdateMarketingConsentResult {
  return { marketingAgreedAt: toNullableInstant(dto.marketingAgreedAt) };
}

export function toUpdateMarketingPushConsentResult(
  dto: UpdateMarketingPushConsentResponse,
): UpdateMarketingPushConsentResult {
  return { marketingPushAgreedAt: toNullableInstant(dto.marketingPushAgreedAt) };
}

export function toUpdateAiDataSharingConsentResult(
  dto: UpdateAiDataSharingConsentResponse,
): UpdateAiDataSharingConsentResult {
  return {
    aiDataSharingDecision: dto.aiDataSharingDecision,
    aiDataSharingAgreedAt: toNullableInstant(dto.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: dto.aiDataSharingConsentVersion,
  };
}
