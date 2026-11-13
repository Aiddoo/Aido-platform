import { INVITE_LINK_BASE_URL } from "@aido/api/vocabulary";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { InviterProfile } from "../../../application/read-models/inviter-profile.read-model.js";
import type { MyInvite } from "../../../application/read-models/my-invite.read-model.js";
import type {
  InviteAvailabilityResponseDto,
  InvitePreviewResponseDto,
  MyInviteResponseDto,
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
