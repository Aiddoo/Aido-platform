import { Inject, Injectable } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import type {
  InviteRewardSchedulerPort,
  InviteRewardTrigger,
} from "../../application/ports/invite-reward-scheduler.port.js";
import {
  INVITE_REWARD_JOB_OPTIONS,
  INVITE_REWARD_QUEUE,
  InviteRewardJobKey,
  type InviteRewardJobData,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteRewardSchedulerAdapter implements InviteRewardSchedulerPort {
  readonly #runtime: JobRuntimePort;

  constructor(@Inject(JOB_RUNTIME) runtime: JobRuntimePort) {
    this.#runtime = runtime;
  }

  async schedule(redemptionId: string, trigger: InviteRewardTrigger): Promise<void> {
    await this.#runtime.enqueue<InviteRewardJobData>(
      INVITE_REWARD_QUEUE,
      { redemptionId },
      {
        ...INVITE_REWARD_JOB_OPTIONS,
        idempotencyKey: InviteRewardJobKey.of(redemptionId, trigger),
      },
    );
  }

  async scheduleMany(
    redemptionIds: readonly string[],
    trigger: InviteRewardTrigger,
  ): Promise<void> {
    if (redemptionIds.length === 0) {
      return;
    }
    await this.#runtime.enqueueMany<InviteRewardJobData>(
      INVITE_REWARD_QUEUE,
      redemptionIds.map((redemptionId) => ({
        data: { redemptionId },
        options: {
          ...INVITE_REWARD_JOB_OPTIONS,
          idempotencyKey: InviteRewardJobKey.of(redemptionId, trigger),
        },
      })),
    );
  }
}
