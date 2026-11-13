import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { type JobEnvelope, JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { InviteRedemptionLogEvent } from "../../application/invite-redemptions.log-events.js";
import { GrantInviteRewardsUseCase } from "../../application/use-cases/grant-invite-rewards.use-case.js";
import { INVITE_REWARD_QUEUE } from "./invite-reward.queue.js";

type InviteRewardJob = JobEnvelope<{ readonly redemptionId: string }>;

@Injectable()
export class InviteRewardProcessor implements OnModuleInit {
  readonly #logger = new Logger(InviteRewardProcessor.name);
  readonly #grantInviteRewards: Pick<GrantInviteRewardsUseCase, "execute">;
  readonly #jobQueue: Pick<JobQueuePort, "work">;

  constructor(
    @Inject(GrantInviteRewardsUseCase)
    grantInviteRewards: Pick<GrantInviteRewardsUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#grantInviteRewards = grantInviteRewards;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(INVITE_REWARD_QUEUE, (jobs) => this.process(jobs));
  }

  async process(jobs: readonly InviteRewardJob[]): Promise<void> {
    for (const job of jobs) {
      const { redemptionId } = job.data;
      try {
        // 큐 재시도는 정비 작업의 하루 단위 재시도 예산을 쓰지 않게 첫 실행만 센다
        await this.#grantInviteRewards.execute({
          redemptionId,
          countsAttempt: job.attempt === 1,
        });
      } catch (error) {
        this.#logger.error({
          event: InviteRedemptionLogEvent.REWARD_JOB_FAILED,
          jobId: job.id,
          attempt: job.attempt,
          redemptionId,
          errorType: toErrorType(error),
        });
        throw error;
      }
    }
  }
}
