import type { ConsentResponse, UpdateMarketingConsentResponse } from '@aido/api';

import type { Consent } from '../domains/consent.model';

const generateConsentDto = (): ConsentResponse => ({
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  privacyAgreedAt: '2026-01-01T00:00:00.000Z',
  agreedTermsVersion: '1.0.0',
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
  marketingPushAgreedAt: null,
});

export const createConsentDto = (overrides?: Partial<ConsentResponse>): ConsentResponse => ({
  ...generateConsentDto(),
  ...overrides,
});

const generateConsent = (): Consent => ({
  termsAgreedAt: new Date('2026-01-01T00:00:00.000Z'),
  privacyAgreedAt: new Date('2026-01-01T00:00:00.000Z'),
  agreedTermsVersion: '1.0.0',
  marketingAgreedAt: new Date('2026-02-01T00:00:00.000Z'),
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
