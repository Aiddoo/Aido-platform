import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type BroadcastDeliveryGroup,
  BroadcastJobEnqueuerPort,
} from "../../application/ports/broadcast-job-enqueuer.port.js";
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

  async enqueueDeliveries(
    campaignId: BroadcastCampaignId,
    groups: readonly BroadcastDeliveryGroup[],
  ): Promise<void> {
    await this.#jobQueue.enqueueMany(
      BROADCAST_DELIVERY_QUEUE,
      groups.flatMap(({ startAfter, userIds }) => {
        const [firstUserId] = userIds;
        if (firstUserId == null) {
          return [];
        }
        return [
          {
            payload: {
              name: BroadcastDeliveryJobName.DELIVER_GROUP,
              data: {
                campaignId: campaignId.value,
                userIds: userIds.map((userId) => userId.value),
              },
            },
            idempotencyKey: broadcastDeliveryJobKey(
              campaignId.value,
              startAfter.toString(),
              firstUserId.value,
            ),
            startAfter,
            priority: BROADCAST_JOB_PRIORITY,
          },
        ];
      }),
    );
  }
}
