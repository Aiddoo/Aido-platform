import { Injectable, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { FailBroadcastCampaignUseCase } from "../../application/use-cases/fail-broadcast-campaign.use-case.js";
import { FanOutBroadcastCampaignUseCase } from "../../application/use-cases/fan-out-broadcast-campaign.use-case.js";
import { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import {
  BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE,
  BROADCAST_FAN_OUT_QUEUE,
} from "./broadcast-fan-out.queue.js";

@Injectable()
export class BroadcastFanOutProcessor implements OnModuleInit {
  readonly #jobQueue: JobQueuePort;
  readonly #fanOutCampaign: FanOutBroadcastCampaignUseCase;
  readonly #failCampaign: FailBroadcastCampaignUseCase;

  constructor(
    jobQueue: JobQueuePort,
    fanOutCampaign: FanOutBroadcastCampaignUseCase,
    failCampaign: FailBroadcastCampaignUseCase,
  ) {
    this.#jobQueue = jobQueue;
    this.#fanOutCampaign = fanOutCampaign;
    this.#failCampaign = failCampaign;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(BROADCAST_FAN_OUT_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.#fanOutCampaign.execute({
          campaignId: BroadcastCampaignId.reconstitute(job.data.data.campaignId),
        });
      }
    });
    await this.#jobQueue.work(BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.#failCampaign.execute({
          campaignId: BroadcastCampaignId.reconstitute(job.data.data.campaignId),
        });
      }
    });
  }
}
