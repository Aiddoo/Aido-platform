import { Inject, Injectable, type OnModuleInit, Optional } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { FailBroadcastCampaignUseCase } from "../../application/use-cases/fail-broadcast-campaign.use-case.js";
import { FanOutBroadcastCampaignUseCase } from "../../application/use-cases/fan-out-broadcast-campaign.use-case.js";
import {
  BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE,
  BROADCAST_FAN_OUT_DEAD_LETTER_WORKER_POLICY,
  BROADCAST_FAN_OUT_QUEUE,
  BROADCAST_FAN_OUT_WORKER_POLICY,
  BroadcastFanOutJobSchema,
} from "./broadcast-fan-out.queue.js";

@Injectable()
export class BroadcastFanOutProcessor implements OnModuleInit {
  readonly #fanOutCampaign: FanOutBroadcastCampaignUseCase;
  readonly #failCampaign: FailBroadcastCampaignUseCase;
  readonly #runtime?: JobRuntimePort;

  constructor(
    fanOutCampaign: FanOutBroadcastCampaignUseCase,
    failCampaign: FailBroadcastCampaignUseCase,
    @Optional()
    @Inject(JOB_RUNTIME)
    runtime?: JobRuntimePort,
  ) {
    this.#fanOutCampaign = fanOutCampaign;
    this.#failCampaign = failCampaign;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    if (!this.#runtime) {
      return;
    }
    await this.#runtime.work(
      BROADCAST_FAN_OUT_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data);
        }
      },
      BROADCAST_FAN_OUT_WORKER_POLICY,
    );
    await this.#runtime.work(
      BROADCAST_FAN_OUT_DEAD_LETTER_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.processDeadLetter(job.data);
        }
      },
      BROADCAST_FAN_OUT_DEAD_LETTER_WORKER_POLICY,
    );
  }

  async process(untrustedJob: unknown): Promise<void> {
    const job = BroadcastFanOutJobSchema.parse(untrustedJob);
    await this.#fanOutCampaign.execute(job.data);
  }

  async processDeadLetter(untrustedJob: unknown): Promise<void> {
    const job = BroadcastFanOutJobSchema.parse(untrustedJob);
    await this.#failCampaign.execute(job.data);
  }
}
