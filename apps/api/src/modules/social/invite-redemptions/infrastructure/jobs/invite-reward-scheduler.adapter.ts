import { Injectable } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import {
  type InviteRewardTrigger,
  InviteRewardSchedulerPort,
} from "../../application/ports/invite-reward-scheduler.port.js";
import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { INVITE_REWARD_QUEUE, InviteRewardJobKey } from "./invite-reward.queue.js";

@Injectable()
export class InviteRewardSchedulerAdapter extends InviteRewardSchedulerPort {
  readonly #jobQueue: Pick<JobQueuePort, "enqueue" | "enqueueMany">;

  constructor(jobQueue: JobQueuePort) {
    super();
    this.#jobQueue = jobQueue;
  }

  async schedule(redemptionId: InviteRedemptionId, trigger: InviteRewardTrigger): Promise<void> {
    await this.#jobQueue.enqueue(
      INVITE_REWARD_QUEUE,
      { redemptionId: redemptionId.value },
      { idempotencyKey: InviteRewardJobKey.of(redemptionId, trigger) },
    );
  }

  async scheduleMany(
    redemptionIds: readonly InviteRedemptionId[],
    trigger: InviteRewardTrigger,
  ): Promise<void> {
    if (redemptionIds.length === 0) {
      return;
    }
    await this.#jobQueue.enqueueMany(
      INVITE_REWARD_QUEUE,
      redemptionIds.map((redemptionId) => ({
        payload: { redemptionId: redemptionId.value },
        idempotencyKey: InviteRewardJobKey.of(redemptionId, trigger),
      })),
    );
  }
}
