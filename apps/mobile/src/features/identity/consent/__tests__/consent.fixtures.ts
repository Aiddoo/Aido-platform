import type { UpdateMarketingConsentResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import type { Consent, ConsentEnvelope } from '../schemas/consent.schema';

const generateConsentDto = (): ConsentEnvelope => ({
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  privacyAgreedAt: '2026-01-01T00:00:00.000Z',
  agreedTermsVersion: '1.0.0',
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
  marketingPushAgreedAt: null,
  aiDataSharingDecision: 'UNDECIDED',
  aiDataSharingAgreedAt: null,
  aiDataSharingConsentVersion: null,
});

export const createConsentDto = (overrides?: Partial<ConsentEnvelope>): ConsentEnvelope => ({
  ...generateConsentDto(),
  ...overrides,
});

const generateConsent = (): Consent => ({
  termsAgreedAt: toInstant('2026-01-01T00:00:00.000Z'),
  privacyAgreedAt: toInstant('2026-01-01T00:00:00.000Z'),
  agreedTermsVersion: '1.0.0',
  marketingAgreedAt: toInstant('2026-02-01T00:00:00.000Z'),
  marketingPushAgreedAt: null,
  aiDataSharingDecision: 'UNDECIDED',
  aiDataSharingAgreedAt: null,
  aiDataSharingConsentVersion: null,
});

export const createConsent = (overrides?: Partial<Consent>): Consent => ({
  ...generateConsent(),
  ...overrides,
});

const generateUpdateMarketingConsentDto = (): UpdateMarketingConsentResponse => ({
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
});

export const createUpdateMarketingConsentDto = (
  overrides?: Partial<UpdateMarketingConsentResponse>,
): UpdateMarketingConsentResponse => ({
  ...generateUpdateMarketingConsentDto(),
  ...overrides,
});
