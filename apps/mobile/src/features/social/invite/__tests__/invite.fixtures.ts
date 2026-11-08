import {
  type InvitedFriendResponse,
  type InvitePreviewResponse,
  invitePreviewResponseSchema,
  type MyInviteResponse,
} from '@aido/api';
import { ApiError } from '@src/core/errors/api-error';
import { toInstant } from '@src/shared/date/instant';

import type { RedemptionResult } from '../schemas/invite-redemption.schema';
import type { PendingRedemption } from '../schemas/invite-redemption.schema';
import type { Invite } from '../schemas/invite.schema';
import type { InvitedFriend } from '../schemas/invited-friend.schema';

export function createPendingRedemption(overrides?: Partial<PendingRedemption>): PendingRedemption {
  return {
    inviteCode: 'K7M2QX',
    source: 'universal_link',
    savedAt: toInstant('2028-02-23T00:00:00Z'),
    ...overrides,
  };
}

// 공개 미리보기에서 태그가 빠져도 그대로 쓰이게 서버 계약 스키마로 만든다(모르는 필드는 버린다)
export function createInvitePreviewDto(
  overrides?: Partial<InvitePreviewResponse['inviter']>,
): InvitePreviewResponse {
  return invitePreviewResponseSchema.parse({
    inviter: { name: '민지', userTag: 'K3MQ9XWA', profileImage: 'orange_tabby', ...overrides },
  });
}

export function createInviteApiError({
  code = 'INVITE_2101',
  status = 404,
}: { code?: string; status?: number } = {}) {
  return new ApiError(code, '초대 코드를 찾을 수 없어요', status);
}

export const INVALID_DTO = { invalid: 'data' };

export function createInviteDto(overrides?: Partial<MyInviteResponse>): MyInviteResponse {
  return {
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
    ...overrides,
  };
}

export function createInvite(overrides?: Partial<Invite>): Invite {
  return {
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
    createdAt: toInstant('2026-11-01T09:00:00.000Z'),
    ...overrides,
  };
}

export function createInvitedFriendDto(
  overrides?: Partial<InvitedFriendResponse>,
): InvitedFriendResponse {
  return {
    userId: 'clz7x5p8k0005qz0z8z8z8z8z',
    name: '준호',
    userTag: 'B7TZ2NPD',
    profileImage: 'russian_blue',
    status: 'JOINED',
    activeDayCount: 1,
    joinedAt: '2026-11-02T10:30:00.000Z',
    qualifiedAt: null,
    ...overrides,
  };
}

export function createInvitedFriend(overrides?: Partial<InvitedFriend>): InvitedFriend {
  return {
    userId: 'clz7x5p8k0005qz0z8z8z8z8z',
    name: '준호',
    userTag: 'B7TZ2NPD',
    profileImage: 'russian_blue',
    status: 'JOINED',
    activeDayCount: 1,
    rejectionReason: null,
    joinedAt: toInstant('2026-11-02T10:30:00.000Z'),
    qualifiedAt: null,
    ...overrides,
  };
}

type RedeemedResult = Extract<RedemptionResult, { outcome: 'REDEEMED' }>;

export function createRedemptionResult(overrides?: Partial<RedeemedResult>): RedeemedResult {
  return {
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
  };
}
