import type { UpdateAiDataSharingConsentResponse } from '@aido/api';
import { toNullableInstant } from '@src/shared/date/instant';

import {
  type Consent,
  type UpdateAiDataSharingConsentResult,
  type UpdateMarketingConsentResult,
  type UpdateMarketingPushConsentResult,
} from '../domains/consent.model';
import {
  type ConsentEnvelope,
  type UpdateMarketingConsentEnvelope,
  type UpdateMarketingPushConsentEnvelope,
} from '../schemas/consent-response.schema';

export function toConsent(dto: ConsentEnvelope): Consent {
  return {
    termsAgreedAt: toNullableInstant(dto.termsAgreedAt),
    privacyAgreedAt: toNullableInstant(dto.privacyAgreedAt),
    agreedTermsVersion: dto.agreedTermsVersion,
    marketingAgreedAt: toNullableInstant(dto.marketingAgreedAt),
    marketingPushAgreedAt: toNullableInstant(dto.marketingPushAgreedAt),
    aiDataSharingDecision: dto.aiDataSharingDecision,
    aiDataSharingAgreedAt: toNullableInstant(dto.aiDataSharingAgreedAt),
    aiDataSharingConsentVersion: dto.aiDataSharingConsentVersion,
  };
}

export function toUpdateMarketingConsentResult(
  dto: UpdateMarketingConsentEnvelope,
): UpdateMarketingConsentResult {
  return {
    marketingAgreedAt: toNullableInstant(dto.marketingAgreedAt),
    marketingWithdrawnAt: toNullableInstant(dto.marketingWithdrawnAt),
  };
}

export function toUpdateMarketingPushConsentResult(
  dto: UpdateMarketingPushConsentEnvelope,
): UpdateMarketingPushConsentResult {
  return {
    marketingPushAgreedAt: toNullableInstant(dto.marketingPushAgreedAt),
    marketingPushWithdrawnAt: toNullableInstant(dto.marketingPushWithdrawnAt),
  };
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
