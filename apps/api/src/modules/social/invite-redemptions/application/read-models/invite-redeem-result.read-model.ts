import type { InviteFriendship, REDEEM_OUTCOME } from "@aido/api/vocabulary";

import type { InviterProfileReadModel } from "#api/modules/social/invites/social-invites.public";

import type { RewardAmount } from "../../domain/invite-reward.domain-service.js";

export type InviteRedeemResultReadModel =
  | {
      readonly outcome: typeof REDEEM_OUTCOME.REDEEMED;
      readonly inviter: InviterProfileReadModel;
      readonly friendship: InviteFriendship;
      readonly rewards: readonly RewardAmount[];
      readonly redemptionId: string;
      /** 응답을 놓친 같은 요청을 다시 받아 저장된 결과를 돌려줬는지 */
      readonly isReplay: boolean;
    }
  | {
      readonly outcome: typeof REDEEM_OUTCOME.CONNECTED;
      readonly inviter: InviterProfileReadModel;
      readonly friendship: InviteFriendship;
    }
  | {
      readonly outcome: typeof REDEEM_OUTCOME.ALREADY_FRIENDS;
      readonly inviter: InviterProfileReadModel;
    };
