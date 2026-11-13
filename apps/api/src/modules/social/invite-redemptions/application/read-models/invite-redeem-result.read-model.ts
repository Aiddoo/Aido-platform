import type { InviteFriendship, REDEEM_OUTCOME } from "@aido/api/vocabulary";

import type { InviterProfile } from "#api/modules/social/invites/social-invites.public";

import type { RewardAmount } from "../../domain/invite-reward.domain-service.js";

export type InviteRedeemResult =
  | {
      readonly outcome: typeof REDEEM_OUTCOME.REDEEMED;
      readonly inviter: InviterProfile;
      readonly friendship: InviteFriendship;
      readonly rewards: readonly RewardAmount[];
      readonly redemptionId: string;
      /** 응답을 놓친 같은 요청을 다시 받아 저장된 결과를 돌려줬는지 */
      readonly isReplay: boolean;
    }
  | {
      readonly outcome: typeof REDEEM_OUTCOME.CONNECTED;
      readonly inviter: InviterProfile;
      readonly friendship: InviteFriendship;
    }
  | {
      readonly outcome: typeof REDEEM_OUTCOME.ALREADY_FRIENDS;
      readonly inviter: InviterProfile;
    };
