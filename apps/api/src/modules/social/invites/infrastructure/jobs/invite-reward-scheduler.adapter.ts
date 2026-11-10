import { Injectable } from "@nestjs/common";

import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import {
  type InviteRewardTrigger,
  InviteRewardSchedulerPort,
} from "../../application/ports/invite-reward-scheduler.port.js";
import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import {
  INVITE_REWARD_JOB_OPTIONS,
  INVITE_REWARD_QUEUE,
  type InviteRewardJobData,
  InviteRewardJobKey,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteRewardSchedulerAdapter extends InviteRewardSchedulerPort {
  readonly #runtime: Pick<JobRuntimePort, "enqueue" | "enqueueMany">;

  constructor(runtime: JobRuntimePort) {
    super();
    this.#runtime = runtime;
  }

  async schedule(redemptionId: InviteRedemptionId, trigger: InviteRewardTrigger): Promise<void> {
    await this.#runtime.enqueue<InviteRewardJobData>(
      INVITE_REWARD_QUEUE,
      { redemptionId: redemptionId.value },
      {
        ...INVITE_REWARD_JOB_OPTIONS,
        idempotencyKey: InviteRewardJobKey.of(redemptionId, trigger),
      },
    );
  }

  async scheduleMany(
    redemptionIds: readonly InviteRedemptionId[],
    trigger: InviteRewardTrigger,
  ): Promise<void> {
    if (redemptionIds.length === 0) {
      return;
    }
    await this.#runtime.enqueueMany<InviteRewardJobData>(
      INVITE_REWARD_QUEUE,
      redemptionIds.map((redemptionId) => ({
        data: { redemptionId: redemptionId.value },
        options: {
          ...INVITE_REWARD_JOB_OPTIONS,
          idempotencyKey: InviteRewardJobKey.of(redemptionId, trigger),
        },
      })),
    );
  }
}
