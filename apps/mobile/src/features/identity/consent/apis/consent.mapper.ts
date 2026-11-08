import type {
  UpdateAiDataSharingConsentResponse,
  UpdateMarketingConsentResponse,
  UpdateMarketingPushConsentResponse,
} from '@aido/api';
import { toNullableInstant } from '@src/shared/date/instant';

import {
  type Consent,
  type UpdateAiDataSharingConsentResult,
  type UpdateMarketingConsentResult,
  type UpdateMarketingPushConsentResult,
} from '../domains/consent.model';
import { type ConsentEnvelope } from '../schemas/consent-response.schema';

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
