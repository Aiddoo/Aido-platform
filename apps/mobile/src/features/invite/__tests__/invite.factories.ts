import {
  type InvitedFriendResponse,
  type InvitePreviewResponse,
  invitePreviewResponseSchema,
  type MyInviteResponse,
} from '@aido/api';
import { ApiError } from '@src/shared/errors/api-error';

import type { RedemptionResult } from '../domains/invite-redemption.model';
import type { PendingRedemption } from '../domains/invite-redemption.model';
import type { Invite } from '../domains/invite.model';
import type { InvitedFriend } from '../domains/invited-friend.model';

export const createPendingRedemption = (
  overrides?: Partial<PendingRedemption>,
): PendingRedemption => ({
  inviteCode: 'K7M2QX',
  source: 'universal_link',
  savedAt: new Date('2028-02-23T00:00:00Z'),
  ...overrides,
});

// 공개 미리보기에서 태그가 빠져도 그대로 쓰이게 서버 계약 스키마로 만든다(모르는 필드는 버린다)
export const createInvitePreviewDto = (
  overrides?: Partial<InvitePreviewResponse['inviter']>,
): InvitePreviewResponse =>
  invitePreviewResponseSchema.parse({
    inviter: { name: '민지', userTag: 'K3MQ9XWA', profileImage: 'orange_tabby', ...overrides },
  });

export const createInviteApiError = ({
  code = 'INVITE_2101',
  status = 404,
}: { code?: string; status?: number } = {}) =>
  new ApiError(code, '초대 코드를 찾을 수 없어요', status);

export const INVALID_DTO = { invalid: 'data' };

export const createInviteDto = (overrides?: Partial<MyInviteResponse>): MyInviteResponse => ({
  code: 'K7M2QX',
  link: 'https://aido.kr/i/K7M2QX',
  waitingCount: 1,
  qualifiedCount: 2,
  premiumDaysInWindow: 14,
  totalPremiumDays: 14,
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
  ...overrides,
});

export const createInvite = (overrides?: Partial<Invite>): Invite => ({
  code: 'K7M2QX',
  link: 'https://aido.kr/i/K7M2QX',
  waitingCount: 0,
  qualifiedCount: 0,
  premiumDaysInWindow: 0,
  totalPremiumDays: 0,
  nextMilestone: {
    qualifiedCount: 1,
    rewards: [
      { rewardType: 'PREMIUM_DAYS', quantity: 7 },
      { rewardType: 'FRIEND_SLOT', quantity: 1 },
    ],
  },
  rewardsEarned: [],
  createdAt: new Date('2026-11-01T09:00:00.000Z'),
  ...overrides,
});

export const createInvitedFriendDto = (
  overrides?: Partial<InvitedFriendResponse>,
): InvitedFriendResponse => ({
  userId: 'clz7x5p8k0005qz0z8z8z8z8z',
  name: '준호',
  userTag: 'B7TZ2NPD',
  profileImage: 'russian_blue',
  status: 'JOINED',
  activeDayCount: 1,
  joinedAt: '2026-11-02T10:30:00.000Z',
  qualifiedAt: null,
  ...overrides,
});

export const createInvitedFriend = (overrides?: Partial<InvitedFriend>): InvitedFriend => ({
  userId: 'clz7x5p8k0005qz0z8z8z8z8z',
  name: '준호',
  userTag: 'B7TZ2NPD',
  profileImage: 'russian_blue',
  status: 'JOINED',
  activeDayCount: 1,
  rejectionReason: null,
  joinedAt: new Date('2026-11-02T10:30:00.000Z'),
  qualifiedAt: null,
  ...overrides,
});

type RedeemedResult = Extract<RedemptionResult, { outcome: 'REDEEMED' }>;

export const createRedemptionResult = (overrides?: Partial<RedeemedResult>): RedeemedResult => ({
  outcome: 'REDEEMED',
  inviter: {
    userId: 'clz7x5p8k0001qz0z8z8z8z8z',
    name: '민지',
    userTag: 'K3MQ9XWA',
    profileImage: 'orange_tabby',
  },
  friendship: 'FRIENDS',
  rewards: [{ rewardType: 'PREMIUM_DAYS', quantity: 7 }],
  ...overrides,
});
