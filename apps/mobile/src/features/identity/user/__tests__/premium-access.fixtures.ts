import { toInstant } from '@src/shared/date/instant';

import { type PremiumAccess } from '../domains/premium-access.model';
import {
  type CurrentUserResponse,
  currentUserResponseSchema,
} from '../schemas/user-response.schema';
import { createCurrentUserDto } from './user.fixtures';

export function createPremiumAccess(overrides?: Partial<PremiumAccess>): PremiumAccess {
  return {
    source: 'GRANT',
    // 11월 1일 14:30 KST
    endsAt: toInstant('2026-11-01T05:30:00Z'),
    periodEndsAt: toInstant('2026-11-01T05:30:00Z'),
    willRenew: false,
    bankedDays: 0,
    grantEndedAt: null,
    ...overrides,
  };
}

function premiumMe(overrides: Partial<CurrentUserResponse>) {
  return currentUserResponseSchema.parse(
    createCurrentUserDto({
      subscriptionStatus: 'ACTIVE',
      isPremium: overrides.premiumSource != null,
      ...overrides,
    }),
  );
}

export const PREMIUM_ME_EXAMPLES = {
  buyDuringReward: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-15T07:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 5,
    premiumGrantEndedAt: null,
  }),
  rewardDuringReward: premiumMe({
    premiumSource: 'GRANT',
    premiumPeriodEndsAt: '2028-03-04T04:00:00.000Z',
    premiumEndsAt: '2028-03-11T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 7,
    premiumGrantEndedAt: null,
  }),
  rewardDuringRenewingSubscription: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-17T07:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 7,
    premiumGrantEndedAt: null,
  }),
  endedReward: premiumMe({
    subscriptionStatus: 'FREE',
    premiumSource: null,
    premiumPeriodEndsAt: null,
    premiumEndsAt: null,
    willRenew: false,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: '2028-03-04T04:00:00.000Z',
  }),
  newRewardAfterEnded: premiumMe({
    premiumSource: 'GRANT',
    premiumPeriodEndsAt: '2028-03-12T04:00:00.000Z',
    premiumEndsAt: '2028-03-12T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
  }),
  cancelledWithBanked: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-03-10T04:00:00.000Z',
    premiumEndsAt: '2028-03-17T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 7,
    premiumGrantEndedAt: null,
  }),
  bankedRewardStarted: premiumMe({
    premiumSource: 'GRANT',
    premiumPeriodEndsAt: '2028-03-17T04:00:00.000Z',
    premiumEndsAt: '2028-03-17T04:00:00.000Z',
    willRenew: false,
    bankedPremiumDays: 0,
    premiumGrantEndedAt: null,
  }),
  resubscribedAfterBankedStarted: premiumMe({
    premiumSource: 'STORE',
    premiumPeriodEndsAt: '2028-04-12T04:00:00.000Z',
    premiumEndsAt: '2028-04-17T07:00:00.000Z',
    willRenew: true,
    bankedPremiumDays: 5,
    premiumGrantEndedAt: null,
  }),
} as const satisfies Record<string, CurrentUserResponse>;
