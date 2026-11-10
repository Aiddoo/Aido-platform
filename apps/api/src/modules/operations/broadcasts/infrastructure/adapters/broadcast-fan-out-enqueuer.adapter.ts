import { Inject, Injectable } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import type { BroadcastFanOutEnqueuerPort } from "../../application/ports/broadcast-fan-out-enqueuer.port.js";
import {
  BROADCAST_FAN_OUT_ENQUEUE_POLICY,
  BROADCAST_FAN_OUT_QUEUE,
  type BroadcastFanOutJob,
  BroadcastFanOutJobName,
  broadcastFanOutJobKey,
} from "../jobs/broadcast-fan-out.queue.js";

@Injectable()
export class BroadcastFanOutQueueService implements BroadcastFanOutEnqueuerPort {
  readonly #runtime: JobRuntimePort;

  constructor(@Inject(JOB_RUNTIME) runtime: JobRuntimePort) {
    this.#runtime = runtime;
  }

  async enqueueFanOut(input: {
    readonly campaignId: string;
    readonly cursorUserId: string | null;
  }): Promise<void> {
    const job: BroadcastFanOutJob = {
      name: BroadcastFanOutJobName.FAN_OUT,
      data: { campaignId: input.campaignId },
    };
    await this.#runtime.enqueue(BROADCAST_FAN_OUT_QUEUE, job, {
      ...BROADCAST_FAN_OUT_ENQUEUE_POLICY,
      idempotencyKey: broadcastFanOutJobKey(input.campaignId, input.cursorUserId),
    });
  }
}
