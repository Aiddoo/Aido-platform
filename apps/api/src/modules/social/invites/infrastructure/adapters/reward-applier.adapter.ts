import { REWARD_TYPE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import { FeatureGranterPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { PremiumGranterPort } from "#api/modules/billing/subscriptions/billing-subscriptions.public";

import { inviteUserNotFound } from "../../application/invites.errors.js";
import { RewardApplierPort } from "../../application/ports/reward-applier.port.js";
import type { RewardGrant } from "../../domain/reward-grant.entity.js";

/**
 * 프리미엄 일수는 billing의 보상 기간으로, 친구 자리는 access의 기능 자리(grant)로 바꾼다.
 * 새 보상 종류는 RewardType 값과 분기 하나만 더한다.
 */
@Injectable()
export class RewardApplierAdapter extends RewardApplierPort {
  readonly #premiumGranter: PremiumGranterPort;
  readonly #featureGranter: Pick<FeatureGranterPort, "grant">;

  constructor(
    @Inject(PremiumGranterPort) premiumGranter: PremiumGranterPort,
    @Inject(FeatureGranterPort) featureGranter: Pick<FeatureGranterPort, "grant">,
  ) {
    super();
    this.#premiumGranter = premiumGranter;
    this.#featureGranter = featureGranter;
  }

  async apply(grant: RewardGrant): Promise<void> {
    await match(grant.rewardType)
      .with(REWARD_TYPE.PREMIUM_DAYS, () => this.#applyPremiumDays(grant))
      .with(REWARD_TYPE.FRIEND_SLOT, () => this.#applyFriendSlot(grant))
      .exhaustive();
  }

  async #applyPremiumDays(grant: RewardGrant): Promise<void> {
    const result = await this.#premiumGranter.grant({
      userId: grant.recipientId,
      source: "INVITE",
      sourceKey: grant.benefitSourceKey,
      durationDays: grant.quantity,
    });
    if (result.status === "user-missing") {
      throw inviteUserNotFound(grant.recipientId);
    }
  }

  async #applyFriendSlot(grant: RewardGrant): Promise<void> {
    await this.#featureGranter.grant({
      userId: grant.recipientId,
      feature: "FRIEND",
      quantity: grant.quantity,
      sourceKey: grant.benefitSourceKey,
    });
  }
}
