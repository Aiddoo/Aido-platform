import type { UserConsent } from "#test/types/database-rows";

export function createUserConsentRowFixture(
  overrides: Partial<UserConsent> & Pick<UserConsent, "userId">,
): UserConsent {
  const now = Temporal.Instant.fromEpochMilliseconds(Date.now());
  return {
    id: `consent-${crypto.randomUUID().slice(0, 8)}`,
    termsAgreedAt: now,
    privacyAgreedAt: now,
    agreedTermsVersion: "1.0.0",
    marketingAgreedAt: null,
    marketingPushAgreedAt: null,
    aiDataSharingAgreedAt: null,
    aiDataSharingVersion: null,
    marketingReconfirmedAt: null,
    ...overrides,
  };
}
