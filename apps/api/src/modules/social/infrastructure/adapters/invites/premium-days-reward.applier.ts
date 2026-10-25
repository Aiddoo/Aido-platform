import { ErrorCode } from "@aido/api/errors";
import { Inject, Injectable } from "@nestjs/common";

import {
  PREMIUM_GRANTER,
  type PremiumGranterPort,
} from "#api/modules/billing/billing-subscriptions.public";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { RewardApplier } from "../../../application/ports/invites/reward-applier.port.js";
import type { RewardGrantRecord } from "../../../application/ports/invites/reward-grant.repository.port.js";
import { rewardGrantSourceKey } from "../../../domain/types/invites/reward-grant.types.js";

/** 프리미엄 일수 보상은 billing이 관리하는 보상 기간으로 바꾼다. */
@Injectable()
export class PremiumDaysRewardApplier implements RewardApplier {
  constructor(@Inject(PREMIUM_GRANTER) private readonly premiumGranter: PremiumGranterPort) {}

  async apply(grant: RewardGrantRecord): Promise<void> {
    const result = await this.premiumGranter.grant({
      userId: grant.recipientId,
      source: "INVITE",
      sourceKey: rewardGrantSourceKey(grant.id),
      durationDays: grant.quantity,
    });
    if (result.status === "user-missing") {
      throw new ApplicationException(ErrorCode.USER_0601, { userId: grant.recipientId });
    }
  }
}
