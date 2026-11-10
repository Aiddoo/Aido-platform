import { ErrorCode } from "@aido/api/errors";
import { Inject, Injectable } from "@nestjs/common";

import {
  PREMIUM_GRANTER,
  type PremiumGranterPort,
} from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { ApplicationException } from "#api/shared/application/application.exception";

import type { RewardApplier } from "../../application/ports/reward-applier.port.js";
import type { RewardGrantRecord } from "../../application/ports/reward-grant.repository.port.js";
import { rewardGrantSourceKey } from "../../domain/reward-grant.constants.js";

/** 프리미엄 일수 보상은 billing이 관리하는 보상 기간으로 바꾼다. */
@Injectable()
export class PremiumDaysRewardApplier implements RewardApplier {
  readonly #premiumGranter: PremiumGranterPort;

  constructor(@Inject(PREMIUM_GRANTER) premiumGranter: PremiumGranterPort) {
    this.#premiumGranter = premiumGranter;
  }

  async apply(grant: RewardGrantRecord): Promise<void> {
    const result = await this.#premiumGranter.grant({
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
