import type { InvitePreviewResponse } from '@aido/api';
import { REDEEM_OUTCOME } from '@aido/api/vocabulary';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';
import type { Page } from '@src/shared/types/page.types';
import { pick } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { InvitePreview } from '../domains/invite-preview.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import type { InviteReward } from '../domains/invite-reward.model';
import type { Invite } from '../domains/invite.model';
import type { InvitedFriend } from '../domains/invited-friend.model';
import type {
  InvitedFriendResponse,
  InvitedFriendsResponse,
  InviteResponse,
  InviteRewardResponse,
  RedeemResponse,
} from '../schemas/invite-response.schema';

function toInviteReward(dto: InviteRewardResponse): InviteReward {
  return pick(dto, ['rewardType', 'quantity']);
}

export function toInvite(dto: InviteResponse): Invite {
  return {
    ...pick(dto, [
      'code',
      'link',
      'waitingCount',
      'qualifiedCount',
      'premiumDaysInWindow',
      'totalPremiumDays',
      'premiumCapState',
    ]),
    nextMilestone:
      dto.nextMilestone == null
        ? null
        : {
            qualifiedCount: dto.nextMilestone.qualifiedCount,
            rewards: dto.nextMilestone.rewards.map(toInviteReward),
          },
    rewardsEarned: dto.rewardsEarned.map(toInviteReward),
    createdAt: toInstant(dto.createdAt),
  };
}

export function toRedemptionResult(dto: RedeemResponse): RedemptionResult {
  const inviter = pick(dto.inviter, ['userId', 'name', 'userTag', 'profileImage']);

  return match(dto)
    .returnType<RedemptionResult>()
    .with({ outcome: REDEEM_OUTCOME.REDEEMED }, (redeemed) => ({
      outcome: redeemed.outcome,
      inviter,
      friendship: redeemed.friendship,
      rewards: redeemed.rewards.map(toInviteReward),
      isReplay: redeemed.isReplay,
    }))
    .with({ outcome: REDEEM_OUTCOME.CONNECTED }, (connected) => ({
      outcome: connected.outcome,
      inviter,
      friendship: connected.friendship,
    }))
    .with({ outcome: REDEEM_OUTCOME.ALREADY_FRIENDS }, (alreadyFriends) => ({
      outcome: alreadyFriends.outcome,
      inviter,
    }))
    .exhaustive();
}

export function toInvitePreview(dto: InvitePreviewResponse): InvitePreview {
  return { inviter: pick(dto.inviter, ['name', 'profileImage']) };
}

function toInvitedFriend(dto: InvitedFriendResponse): InvitedFriend {
  return {
    ...pick(dto, ['userId', 'name', 'userTag', 'profileImage', 'status', 'activeDayCount']),
    joinedAt: toInstant(dto.joinedAt),
    qualifiedAt: toNullableInstant(dto.qualifiedAt),
    rejectionReason: dto.rejectionReason,
  };
}

export function toInvitedFriendsPage(dto: InvitedFriendsResponse): Page<InvitedFriend> {
  return {
    items: dto.items.map(toInvitedFriend),
    totalCount: dto.totalCount,
    hasMore: dto.hasMore,
  };
}
