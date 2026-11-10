import { Inject, Injectable } from "@nestjs/common";

import {
  RESOURCE_BONUS_GRANTER,
  type ResourceBonusGranterPort,
} from "#api/modules/access/access-entitlement.public";

import type { RewardApplier } from "../../application/ports/reward-applier.port.js";
import type { RewardGrantRecord } from "../../application/ports/reward-grant.repository.port.js";
import { rewardGrantSourceKey } from "../../domain/reward-grant.constants.js";

/** 친구 자리 보상은 access의 리소스 보너스로 바꾼다. */
@Injectable()
export class FriendSlotRewardApplier implements RewardApplier {
  readonly #resourceBonusGranter: ResourceBonusGranterPort;

  constructor(@Inject(RESOURCE_BONUS_GRANTER) resourceBonusGranter: ResourceBonusGranterPort) {
    this.#resourceBonusGranter = resourceBonusGranter;
  }

  async apply(grant: RewardGrantRecord): Promise<void> {
    await this.#resourceBonusGranter.grant({
      userId: grant.recipientId,
      resource: "FRIEND",
      quantity: grant.quantity,
      sourceKey: rewardGrantSourceKey(grant.id),
    });
  }
}
