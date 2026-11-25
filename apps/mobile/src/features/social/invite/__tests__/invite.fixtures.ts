import {
  invitedFriendResponseSchema,
  invitePreviewResponseSchema,
  myInviteResponseSchema,
  redeemInviteResponseSchema,
} from '@aido/api/contracts/invite/v1';
import type { ErrorCodeType } from '@aido/api/errors';
import { createApiError } from '@src/testing/api-error';
import { defineFixture } from '@src/testing/fixture';

import { redemptionResultSchema } from '../domains/invite-redemption.model';
import { inviteSchema } from '../domains/invite.model';
import { invitedFriendSchema } from '../domains/invited-friend.model';
import { pendingRedemptionSchema } from '../domains/pending-redemption.model';

export const createPendingRedemption = defineFixture(pendingRedemptionSchema, {
  inviteCode: 'K7M2QX',
  source: 'universal_link',
  savedAt: '2028-02-23T00:00:00Z',
});

export const createInvitePreviewDto = defineFixture(invitePreviewResponseSchema, {
  inviter: { name: '민지', profileImage: 'orange_tabby' },
});

export function createInviteApiError({
  code = 'INVITE_2101',
  status = 404,
}: { code?: ErrorCodeType; status?: number } = {}) {
  return createApiError(code, { message: '초대 코드를 찾을 수 없어요', status });
}

export const INVALID_DTO = { invalid: 'data' };

export const createInviteDto = defineFixture(myInviteResponseSchema, {
  code: 'K7M2QX',
  link: 'https://aido.kr/i/K7M2QX',
  waitingCount: 1,
  qualifiedCount: 2,
  premiumDaysInWindow: 14,
  totalPremiumDays: 14,
  premiumCapState: 'AVAILABLE',
  nextMilestone: {
    qualifiedCount: 3,
    rewards: [
      { rewardType: 'PREMIUM_DAYS', quantity: 7 },
      { rewardType: 'FRIEND_SLOT', quantity: 1 },
    ],
  },
  rewardsEarned: [
    { rewardType: 'PREMIUM_DAYS', quantity: 14 },
    { rewardType: 'FRIEND_SLOT', quantity: 2 },
  ],
  createdAt: '2026-11-01T09:00:00.000Z',
});

export const createInvite = defineFixture(inviteSchema, {
  code: 'K7M2QX',
  link: 'https://aido.kr/i/K7M2QX',
  waitingCount: 0,
  qualifiedCount: 0,
  premiumDaysInWindow: 0,
  totalPremiumDays: 0,
  premiumCapState: 'AVAILABLE',
  nextMilestone: {
    qualifiedCount: 1,
    rewards: [
      { rewardType: 'PREMIUM_DAYS', quantity: 7 },
      { rewardType: 'FRIEND_SLOT', quantity: 1 },
    ],
  },
  rewardsEarned: [],
  createdAt: '2026-11-01T09:00:00.000Z',
});

export const createInvitedFriendDto = defineFixture(invitedFriendResponseSchema, {
  userId: 'clz7x5p8k0005qz0z8z8z8z8z',
  name: '준호',
  userTag: 'B7TZ2NPD',
  profileImage: 'russian_blue',
  status: 'JOINED',
  activeDayCount: 1,
  joinedAt: '2026-11-02T10:30:00.000Z',
  qualifiedAt: null,
  rejectionReason: null,
});

export const createInvitedFriend = defineFixture(invitedFriendSchema, {
  userId: 'clz7x5p8k0005qz0z8z8z8z8z',
  name: '준호',
  userTag: 'B7TZ2NPD',
  profileImage: 'russian_blue',
  status: 'JOINED',
  activeDayCount: 1,
  rejectionReason: null,
  joinedAt: '2026-11-02T10:30:00.000Z',
  qualifiedAt: null,
});

const INVITER = {
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  name: '민지',
  userTag: 'K3MQ9XWA',
  profileImage: 'orange_tabby',
};

const [redeemedResultSchema] = redemptionResultSchema.options;

export const createRedemptionResult = defineFixture(redeemedResultSchema, {
  outcome: 'REDEEMED',
  inviter: INVITER,
  friendship: 'FRIENDS',
  rewards: [{ rewardType: 'PREMIUM_DAYS', quantity: 7 }],
  isReplay: false,
});

export const createRedeemResponseDto = defineFixture(redeemInviteResponseSchema, {
  outcome: 'REDEEMED',
  inviter: INVITER,
  friendship: 'FRIENDS',
  rewards: [{ rewardType: 'PREMIUM_DAYS', quantity: 7 }],
  isReplay: false,
});
