import { defineFixture } from '@src/testing/fixture';

import { consentSchema } from '../domains/consent.model';
import {
  consentEnvelopeSchema,
  updateMarketingConsentEnvelopeSchema,
} from '../schemas/consent-response.schema';

const CONSENT = {
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  privacyAgreedAt: '2026-01-01T00:00:00.000Z',
  agreedTermsVersion: '1.0.0',
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
  marketingPushAgreedAt: null,
  aiDataSharingDecision: 'UNDECIDED',
  aiDataSharingAgreedAt: null,
  aiDataSharingConsentVersion: null,
} as const;

export const createConsentDto = defineFixture(consentEnvelopeSchema, CONSENT);

export const createConsent = defineFixture(consentSchema, CONSENT);

export const createUpdateMarketingConsentDto = defineFixture(updateMarketingConsentEnvelopeSchema, {
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
  marketingWithdrawnAt: null,
});
