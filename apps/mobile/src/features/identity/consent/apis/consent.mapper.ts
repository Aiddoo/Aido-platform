import type {
  ConsentResponse,
  UpdateAiDataSharingConsentResponse,
  UpdateMarketingConsentResponse,
  UpdateMarketingPushConsentResponse,
} from '@aido/api';

import type {
  Consent,
  UpdateAiDataSharingConsentResult,
  UpdateMarketingConsentResult,
  UpdateMarketingPushConsentResult,
} from '../domains/consent.model';

export const toConsent = (dto: ConsentResponse): Consent => ({
  termsAgreedAt: dto.termsAgreedAt ? new Date(dto.termsAgreedAt) : null,
  privacyAgreedAt: dto.privacyAgreedAt ? new Date(dto.privacyAgreedAt) : null,
  agreedTermsVersion: dto.agreedTermsVersion,
  marketingAgreedAt: dto.marketingAgreedAt ? new Date(dto.marketingAgreedAt) : null,
  marketingPushAgreedAt: dto.marketingPushAgreedAt ? new Date(dto.marketingPushAgreedAt) : null,
  // 1.13.0 이전 서버는 AI 동의 필드를 주지 않는다. 답하지 않은 것으로 보고 AI 전에 안내를 띄운다
  aiDataSharingDecision: dto.aiDataSharingDecision ?? 'UNDECIDED',
  aiDataSharingAgreedAt: dto.aiDataSharingAgreedAt ? new Date(dto.aiDataSharingAgreedAt) : null,
  aiDataSharingConsentVersion: dto.aiDataSharingConsentVersion ?? null,
});

export const toUpdateMarketingConsentResult = (
  dto: UpdateMarketingConsentResponse,
): UpdateMarketingConsentResult => ({
  marketingAgreedAt: dto.marketingAgreedAt ? new Date(dto.marketingAgreedAt) : null,
});

export const toUpdateMarketingPushConsentResult = (
  dto: UpdateMarketingPushConsentResponse,
): UpdateMarketingPushConsentResult => ({
  marketingPushAgreedAt: dto.marketingPushAgreedAt ? new Date(dto.marketingPushAgreedAt) : null,
});

export const toUpdateAiDataSharingConsentResult = (
  dto: UpdateAiDataSharingConsentResponse,
): UpdateAiDataSharingConsentResult => ({
  aiDataSharingDecision: dto.aiDataSharingDecision,
  aiDataSharingAgreedAt: dto.aiDataSharingAgreedAt ? new Date(dto.aiDataSharingAgreedAt) : null,
  aiDataSharingConsentVersion: dto.aiDataSharingConsentVersion,
});
