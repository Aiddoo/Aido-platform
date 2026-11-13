import { toInstant } from '@src/shared/date/instant';

import { type Consent, consentSchema } from '../domains/consent.model';
import {
  type ConsentEnvelope,
  consentEnvelopeSchema,
  type UpdateMarketingConsentEnvelope,
} from '../schemas/consent-response.schema';

function generateConsentDto(): ConsentEnvelope {
  return {
    termsAgreedAt: '2026-01-01T00:00:00.000Z',
    privacyAgreedAt: '2026-01-01T00:00:00.000Z',
    agreedTermsVersion: '1.0.0',
    marketingAgreedAt: '2026-02-01T00:00:00.000Z',
    marketingPushAgreedAt: null,
    aiDataSharingDecision: 'UNDECIDED',
    aiDataSharingAgreedAt: null,
    aiDataSharingConsentVersion: null,
  };
}

export function createConsentDto(overrides?: Partial<ConsentEnvelope>): ConsentEnvelope {
  return consentEnvelopeSchema.parse({ ...generateConsentDto(), ...overrides });
}

function generateConsent(): Consent {
  return {
    termsAgreedAt: toInstant('2026-01-01T00:00:00.000Z'),
    privacyAgreedAt: toInstant('2026-01-01T00:00:00.000Z'),
    agreedTermsVersion: '1.0.0',
    marketingAgreedAt: toInstant('2026-02-01T00:00:00.000Z'),
    marketingPushAgreedAt: null,
    aiDataSharingDecision: 'UNDECIDED',
    aiDataSharingAgreedAt: null,
    aiDataSharingConsentVersion: null,
  };
}

export function createConsent(overrides?: Partial<Consent>): Consent {
  return consentSchema.parse({ ...generateConsent(), ...overrides });
}

function generateUpdateMarketingConsentDto(): UpdateMarketingConsentEnvelope {
  return {
    marketingAgreedAt: '2026-02-01T00:00:00.000Z',
    marketingWithdrawnAt: null,
  };
}

export function createUpdateMarketingConsentDto(
  overrides?: Partial<UpdateMarketingConsentEnvelope>,
): UpdateMarketingConsentEnvelope {
  return {
    ...generateUpdateMarketingConsentDto(),
    ...overrides,
  };
}
