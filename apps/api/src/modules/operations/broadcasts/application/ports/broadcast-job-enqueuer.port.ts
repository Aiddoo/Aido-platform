import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";

export interface BroadcastDeliveryGroup {
  readonly startAfter: Temporal.Instant;
  readonly userIds: readonly UserId[];
}

/** 두 메서드 모두 활성 UoW가 있으면 캠페인 저장과 같은 트랜잭션으로 커밋된다. */
export abstract class BroadcastJobEnqueuerPort {
  /** 같은 캠페인의 같은 cursor 작업은 한 번만 남는다. */
  abstract enqueueFanOut(input: {
    readonly campaignId: BroadcastCampaignId;
    readonly cursorUserId: UserId | null;
  }): Promise<void>;
  /** 묶음마다 startAfter에 그 사용자들의 알림을 만든다. 한 번에 등록하고 같은 캠페인·시각·묶음은 한 번만 남는다. */
  abstract enqueueDeliveries(
    campaignId: BroadcastCampaignId,
    groups: readonly BroadcastDeliveryGroup[],
  ): Promise<void>;
}
