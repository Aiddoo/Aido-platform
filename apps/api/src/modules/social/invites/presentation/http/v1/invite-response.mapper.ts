import { INVITE_LINK_BASE_URL, REDEEM_OUTCOME } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { InviteRedeemResult } from "../../../application/read-models/invite-redeem-result.read-model.js";
import type { InvitedFriendsPage } from "../../../application/read-models/invited-friend.read-model.js";
import type { InviterProfile } from "../../../application/read-models/inviter-profile.read-model.js";
import type { MyInvite } from "../../../application/read-models/my-invite.read-model.js";
import type {
  InviteAvailabilityResponseDto,
  InvitedFriendsListResponseDto,
  InvitePreviewResponseDto,
  MyInviteResponseDto,
  RedeemInviteResponseDto,
} from "./invite.dto.js";

function toInviteLink(code: string): string {
  return `${INVITE_LINK_BASE_URL}/${code}`;
}

export function toInviteAvailabilityResponse(isEnabled: boolean): InviteAvailabilityResponseDto {
  return { enabled: isEnabled };
}

export function toMyInviteResponse(myInvite: MyInvite): MyInviteResponseDto {
  return {
    code: myInvite.code,
    link: toInviteLink(myInvite.code),
    waitingCount: myInvite.waitingCount,
    qualifiedCount: myInvite.qualifiedCount,
    premiumDaysInWindow: myInvite.premiumDaysInWindow,
    totalPremiumDays: myInvite.totalPremiumDays,
    premiumCapState: myInvite.premiumCapState,
    nextMilestone:
      myInvite.nextMilestone == null
        ? null
        : {
            qualifiedCount: myInvite.nextMilestone.qualifiedCount,
            rewards: [...myInvite.nextMilestone.rewards],
          },
    rewardsEarned: [...myInvite.rewardsEarned],
    createdAt: toIsoString(myInvite.createdAt),
  };
}

export function toInvitePreviewResponse(inviter: InviterProfile): InvitePreviewResponseDto {
  return { inviter: { name: inviter.name, profileImage: inviter.profileImage } };
}

export function toRedeemInviteResponse(result: InviteRedeemResult): RedeemInviteResponseDto {
  return match(result)
    .returnType<RedeemInviteResponseDto>()
    .with({ outcome: REDEEM_OUTCOME.REDEEMED }, (redeemed) => ({
      outcome: REDEEM_OUTCOME.REDEEMED,
      inviter: redeemed.inviter,
      friendship: redeemed.friendship,
      rewards: [...redeemed.rewards],
      isReplay: redeemed.isReplay,
    }))
    .with({ outcome: REDEEM_OUTCOME.CONNECTED }, (connected) => ({
      outcome: REDEEM_OUTCOME.CONNECTED,
      inviter: connected.inviter,
      friendship: connected.friendship,
    }))
    .with({ outcome: REDEEM_OUTCOME.ALREADY_FRIENDS }, (unchanged) => ({
      outcome: REDEEM_OUTCOME.ALREADY_FRIENDS,
      inviter: unchanged.inviter,
    }))
    .exhaustive();
}

// 출시 앱이 읽는 친구 목록 모양({ items, totalCount, hasMore })을 그대로 만든다
export function toInvitedFriendsListResponse(
  page: InvitedFriendsPage,
): InvitedFriendsListResponseDto {
  return {
    items: page.items.map((friend) => ({
      userId: friend.userId,
      name: friend.name,
      userTag: friend.userTag,
      profileImage: friend.profileImage,
      status: friend.status,
      activeDayCount: friend.activeDayCount,
      joinedAt: toIsoString(friend.joinedAt),
      qualifiedAt: friend.qualifiedAt == null ? null : toIsoString(friend.qualifiedAt),
      rejectionReason: friend.rejectionReason,
    })),
    totalCount: page.totalCount,
    hasMore: page.pagination.hasNext,
  };
}
