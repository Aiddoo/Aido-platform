import {
  type BroadcastDeliveryGroup,
  BroadcastJobEnqueuerPort,
} from "#api/modules/operations/broadcasts/application/ports/broadcast-job-enqueuer.port";
import type { BroadcastCampaignId } from "#api/modules/operations/broadcasts/domain/broadcast-campaign-id.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface RecordedFanOut {
  readonly campaignId: string;
  readonly cursorUserId: string | null;
}

export interface RecordedDelivery {
  readonly campaignId: string;
  readonly startAfter: Temporal.Instant;
  readonly userIds: readonly string[];
}

export class RecordingBroadcastJobEnqueuer extends BroadcastJobEnqueuerPort {
  readonly fanOuts: RecordedFanOut[] = [];
  readonly deliveries: RecordedDelivery[] = [];
  deliveryCalls = 0;

  async enqueueFanOut(input: {
    readonly campaignId: BroadcastCampaignId;
    readonly cursorUserId: UserId | null;
  }): Promise<void> {
    this.fanOuts.push({
      campaignId: input.campaignId.value,
      cursorUserId: input.cursorUserId?.value ?? null,
    });
  }

  async enqueueDeliveries(
    campaignId: BroadcastCampaignId,
    groups: readonly BroadcastDeliveryGroup[],
  ): Promise<void> {
    this.deliveryCalls += 1;
    this.deliveries.push(
      ...groups.map((group) => ({
        campaignId: campaignId.value,
        startAfter: group.startAfter,
        userIds: group.userIds.map(({ value }) => value),
      })),
    );
  }
}
