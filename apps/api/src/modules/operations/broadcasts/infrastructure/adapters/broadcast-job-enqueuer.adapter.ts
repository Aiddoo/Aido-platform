import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { BroadcastJobEnqueuerPort } from "../../application/ports/broadcast-job-enqueuer.port.js";
import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import { BROADCAST_JOB_PRIORITY } from "../../domain/broadcasts.constants.js";
import {
  BROADCAST_DELIVERY_QUEUE,
  BroadcastDeliveryJobName,
  broadcastDeliveryJobKey,
} from "../jobs/broadcast-delivery.queue.js";
import {
  BROADCAST_FAN_OUT_QUEUE,
  BroadcastFanOutJobName,
  broadcastFanOutJobKey,
} from "../jobs/broadcast-fan-out.queue.js";

@Injectable()
export class BroadcastJobEnqueuerAdapter extends BroadcastJobEnqueuerPort {
  readonly #jobQueue: JobQueuePort;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async enqueueFanOut(input: {
    readonly campaignId: BroadcastCampaignId;
    readonly cursorUserId: UserId | null;
  }): Promise<void> {
    await this.#jobQueue.enqueue(
      BROADCAST_FAN_OUT_QUEUE,
      { name: BroadcastFanOutJobName.FAN_OUT, data: { campaignId: input.campaignId.value } },
      {
        idempotencyKey: broadcastFanOutJobKey(
          input.campaignId.value,
          input.cursorUserId?.value ?? null,
        ),
        priority: BROADCAST_JOB_PRIORITY,
      },
    );
  }

  async enqueueDelivery(input: {
    readonly campaignId: BroadcastCampaignId;
    readonly startAfter: Temporal.Instant;
    readonly userIds: readonly UserId[];
  }): Promise<void> {
    const [firstUserId] = input.userIds;
    if (firstUserId == null) {
      return;
    }
    await this.#jobQueue.enqueue(
      BROADCAST_DELIVERY_QUEUE,
      {
        name: BroadcastDeliveryJobName.DELIVER_GROUP,
        data: {
          campaignId: input.campaignId.value,
          userIds: input.userIds.map((userId) => userId.value),
        },
      },
      {
        idempotencyKey: broadcastDeliveryJobKey(
          input.campaignId.value,
          input.startAfter.toString(),
          firstUserId.value,
        ),
        startAfter: input.startAfter,
        priority: BROADCAST_JOB_PRIORITY,
      },
    );
  }
}
