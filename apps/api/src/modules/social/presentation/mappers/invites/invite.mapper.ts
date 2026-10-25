import { INVITE_LINK_BASE_URL } from "@aido/api/vocabulary";

import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";

import type { InviterProfile } from "../../../application/ports/invites/invite.repository.port.js";
import type { MyInviteView } from "../../../application/read-models/invites/my-invite.read-model.js";
import type { InvitedFriendsPage } from "../../../application/use-cases/invites/get-invited-friends.use-case.js";
import type {
  InvitedFriendsListResponseDto,
  InvitePreviewResponseDto,
  MyInviteResponseDto,
} from "../../schemas/invites/index.js";

function toInviteLink(code: string): string {
  return `${INVITE_LINK_BASE_URL}/${code}`;
}

export const InviteMapper = {
  toMyInviteDto(view: MyInviteView): MyInviteResponseDto {
    return {
      code: view.code,
      link: toInviteLink(view.code),
      waitingCount: view.waitingCount,
      qualifiedCount: view.qualifiedCount,
      premiumDaysInWindow: view.premiumDaysInWindow,
      totalPremiumDays: view.totalPremiumDays,
      nextMilestone:
        view.nextMilestone === null
          ? null
          : {
              qualifiedCount: view.nextMilestone.qualifiedCount,
              rewards: [...view.nextMilestone.rewards],
            },
      rewardsEarned: [...view.rewardsEarned],
      createdAt: toISOString(view.createdAt),
    };
  },

  toPreviewDto(inviter: InviterProfile): InvitePreviewResponseDto {
    return {
      inviter: { name: inviter.name, profileImage: inviter.profileImage },
    };
  },

  toInvitedFriendsDto(page: InvitedFriendsPage): InvitedFriendsListResponseDto {
    return {
      items: page.items.map((friend) => ({
        userId: friend.userId,
        name: friend.name,
        userTag: friend.userTag,
        profileImage: friend.profileImage,
        status: friend.status,
        activeDayCount: friend.activeDayCount,
        joinedAt: toISOString(friend.joinedAt),
        qualifiedAt: toISOStringOrNull(friend.qualifiedAt),
        rejectionReason: friend.rejectionReason,
      })),
      totalCount: page.totalCount,
      hasMore: page.hasMore,
    };
  },
};
