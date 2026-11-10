import { REWARD_TYPE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import {
  RESOURCE_BONUS_GRANTER,
  type ResourceBonusGranterPort,
} from "#api/modules/access/access-entitlement.public";
import { PremiumGranterPort } from "#api/modules/billing/subscriptions/billing-subscriptions.public";

import { inviteUserNotFound } from "../../application/invites.errors.js";
import { RewardApplierPort } from "../../application/ports/reward-applier.port.js";
import type { RewardGrant } from "../../domain/reward-grant.entity.js";

/**
 * 프리미엄 일수는 billing의 보상 기간으로, 친구 자리는 access의 리소스 보너스로 바꾼다.
 * 새 보상 종류는 RewardType 값과 분기 하나만 더한다.
 */
@Injectable()
export class RewardApplierAdapter extends RewardApplierPort {
  readonly #premiumGranter: PremiumGranterPort;
  readonly #resourceBonusGranter: ResourceBonusGranterPort;

  constructor(
    @Inject(PremiumGranterPort) premiumGranter: PremiumGranterPort,
    @Inject(RESOURCE_BONUS_GRANTER) resourceBonusGranter: ResourceBonusGranterPort,
  ) {
    super();
    this.#premiumGranter = premiumGranter;
    this.#resourceBonusGranter = resourceBonusGranter;
  }

  async apply(grant: RewardGrant): Promise<void> {
    await match(grant.rewardType)
      .with(REWARD_TYPE.PREMIUM_DAYS, () => this.#applyPremiumDays(grant))
      .with(REWARD_TYPE.FRIEND_SLOT, () => this.#applyFriendSlot(grant))
      .exhaustive();
  }

  async #applyPremiumDays(grant: RewardGrant): Promise<void> {
    const result = await this.#premiumGranter.grant({
      userId: grant.recipientId.value,
      source: "INVITE",
      sourceKey: grant.benefitSourceKey,
      durationDays: grant.quantity,
    });
    if (result.status === "user-missing") {
      throw inviteUserNotFound(grant.recipientId);
    }
  }

  async #applyFriendSlot(grant: RewardGrant): Promise<void> {
    await this.#resourceBonusGranter.grant({
      userId: grant.recipientId.value,
      resource: "FRIEND",
      quantity: grant.quantity,
      sourceKey: grant.benefitSourceKey,
    });
  }
}
