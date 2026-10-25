import { Inject, Injectable } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import type {
  InviteRewardSchedulerPort,
  InviteRewardTrigger,
} from "../../../application/ports/invites/invite-reward.scheduler.port.js";
import {
  INVITE_REWARD_JOB_OPTIONS,
  INVITE_REWARD_QUEUE,
  InviteRewardJobKey,
  type InviteRewardJobData,
} from "./invite-reward-queue.constants.js";

@Injectable()
export class InviteRewardSchedulerAdapter implements InviteRewardSchedulerPort {
  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  async schedule(redemptionId: string, trigger: InviteRewardTrigger): Promise<void> {
    await this.runtime.enqueue<InviteRewardJobData>(
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
    if (redemptionIds.length === 0) return;
    await this.runtime.enqueueMany<InviteRewardJobData>(
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
