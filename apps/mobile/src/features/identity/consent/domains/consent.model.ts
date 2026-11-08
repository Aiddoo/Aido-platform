import {
  AI_DATA_SHARING_CONSENT,
  AI_DATA_SHARING_DECISION,
  AI_DATA_SHARING_DECISIONS,
} from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const consentSchema = z.object({
  termsAgreedAt: instantSchema.nullable(),
  privacyAgreedAt: instantSchema.nullable(),
  agreedTermsVersion: z.string().nullable(),
  marketingAgreedAt: instantSchema.nullable(),
  marketingPushAgreedAt: instantSchema.nullable(),
  aiDataSharingDecision: z.enum(AI_DATA_SHARING_DECISIONS),
  aiDataSharingAgreedAt: instantSchema.nullable(),
  aiDataSharingConsentVersion: z.string().nullable(),
});
export type Consent = z.infer<typeof consentSchema>;

export const updateMarketingConsentResultSchema = z.object({
  marketingAgreedAt: instantSchema.nullable(),
});
export type UpdateMarketingConsentResult = z.infer<typeof updateMarketingConsentResultSchema>;

export const updateMarketingPushConsentResultSchema = z.object({
  marketingPushAgreedAt: instantSchema.nullable(),
});
export type UpdateMarketingPushConsentResult = z.infer<
  typeof updateMarketingPushConsentResultSchema
>;

export const updateAiDataSharingConsentResultSchema = z.object({
  aiDataSharingDecision: z.enum(AI_DATA_SHARING_DECISIONS),
  aiDataSharingAgreedAt: instantSchema.nullable(),
  aiDataSharingConsentVersion: z.string().nullable(),
});
export type UpdateAiDataSharingConsentResult = z.infer<
  typeof updateAiDataSharingConsentResultSchema
>;

function hasAgreedToAiDataSharing(consent: Pick<Consent, 'aiDataSharingDecision'>) {
  return consent.aiDataSharingDecision === AI_DATA_SHARING_DECISION.AGREED;
}

function shouldShowAiConsentRenewal(
  consent: Pick<Consent, 'aiDataSharingDecision' | 'aiDataSharingConsentVersion'>,
) {
  return (
    hasAgreedToAiDataSharing(consent) &&
    consent.aiDataSharingConsentVersion != null &&
    consent.aiDataSharingConsentVersion !== AI_DATA_SHARING_CONSENT.VERSION
  );
}

export const ConsentPolicy = {
  hasAgreedToAiDataSharing,
  shouldShowAiConsentRenewal,
} as const;
