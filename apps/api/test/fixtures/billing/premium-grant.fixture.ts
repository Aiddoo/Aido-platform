import {
  PremiumGrant,
  type PremiumGrantPrimitives,
} from "#api/modules/billing/premium-grants/domain/premium-grant.aggregate";

import { SUBSCRIPTION_FIXTURE_NOW, SUBSCRIPTION_FIXTURE_USER_ID } from "./subscription.fixture.js";

export const PREMIUM_GRANT_FIXTURE_NOW = SUBSCRIPTION_FIXTURE_NOW;

/** 진행 중인 7일 보상 기간. 시작은 NOW다. */
export function createPremiumGrantFixture(
  overrides: Partial<PremiumGrantPrimitives> = {},
): PremiumGrant {
  return PremiumGrant.reconstitute({
    id: "grant-1",
    userId: SUBSCRIPTION_FIXTURE_USER_ID,
    source: "INVITE",
    sourceKey: "invite:fixture-1",
    durationDays: 7,
    durationMs: null,
    status: "ACTIVE",
    startsAt: PREMIUM_GRANT_FIXTURE_NOW,
    endsAt: PREMIUM_GRANT_FIXTURE_NOW.add({ hours: 24 * 7 }),
    endingNotifiedAt: null,
    createdAt: PREMIUM_GRANT_FIXTURE_NOW,
    updatedAt: PREMIUM_GRANT_FIXTURE_NOW,
    ...overrides,
  });
}

/** 쌓아 둔 기간. 시작·끝이 없다. */
export function createBankedPremiumGrantFixture(
  overrides: Partial<PremiumGrantPrimitives> = {},
): PremiumGrant {
  return createPremiumGrantFixture({
    id: "grant-banked",
    sourceKey: "invite:fixture-banked",
    status: "BANKED",
    startsAt: null,
    endsAt: null,
    ...overrides,
  });
}
