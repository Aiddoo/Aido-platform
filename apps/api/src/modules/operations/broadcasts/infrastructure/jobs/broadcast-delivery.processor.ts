import { Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { DeliverBroadcastGroupUseCase } from "../../application/use-cases/deliver-broadcast-group.use-case.js";
import { ReportBroadcastDeliveryExhaustedUseCase } from "../../application/use-cases/report-broadcast-delivery-exhausted.use-case.js";
import { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import {
  BROADCAST_DELIVERY_DEAD_LETTER_QUEUE,
  BROADCAST_DELIVERY_QUEUE,
} from "./broadcast-delivery.queue.js";

@Injectable()
export class BroadcastDeliveryProcessor implements OnModuleInit {
  readonly #jobQueue: JobQueuePort;
  readonly #deliverGroup: DeliverBroadcastGroupUseCase;
  readonly #reportExhausted: ReportBroadcastDeliveryExhaustedUseCase;

  constructor(
    jobQueue: JobQueuePort,
    deliverGroup: DeliverBroadcastGroupUseCase,
    reportExhausted: ReportBroadcastDeliveryExhaustedUseCase,
  ) {
    this.#jobQueue = jobQueue;
    this.#deliverGroup = deliverGroup;
    this.#reportExhausted = reportExhausted;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(BROADCAST_DELIVERY_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.#deliverGroup.execute({
          campaignId: BroadcastCampaignId.reconstitute(job.data.data.campaignId),
          userIds: job.data.data.userIds.map((userId) => UserId.reconstitute(userId)),
        });
      }
    });
    await this.#jobQueue.work(BROADCAST_DELIVERY_DEAD_LETTER_QUEUE, async (jobs) => {
      for (const job of jobs) {
        this.#reportExhausted.execute({
          campaignId: BroadcastCampaignId.reconstitute(job.data.data.campaignId),
          recipientCount: job.data.data.userIds.length,
        });
      }
    });
  }
}
