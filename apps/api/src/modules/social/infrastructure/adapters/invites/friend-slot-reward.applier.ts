import { Inject, Injectable } from "@nestjs/common";

import {
  RESOURCE_BONUS_GRANTER,
  Resource,
  type ResourceBonusGranterPort,
} from "#api/modules/access/access-entitlement.public";

import type { RewardApplier } from "../../../application/ports/invites/reward-applier.port.js";
import type { RewardGrantRecord } from "../../../application/ports/invites/reward-grant.repository.port.js";
import { rewardGrantSourceKey } from "../../../domain/types/invites/reward-grant.types.js";

/** 친구 자리 보상은 access의 리소스 보너스로 바꾼다. */
@Injectable()
export class FriendSlotRewardApplier implements RewardApplier {
  constructor(
    @Inject(RESOURCE_BONUS_GRANTER) private readonly resourceBonusGranter: ResourceBonusGranterPort,
  ) {}

  async apply(grant: RewardGrantRecord): Promise<void> {
    await this.resourceBonusGranter.grant({
      userId: grant.recipientId,
      resource: Resource.FRIEND,
      quantity: grant.quantity,
      sourceKey: rewardGrantSourceKey(grant.id),
    });
  }
}
