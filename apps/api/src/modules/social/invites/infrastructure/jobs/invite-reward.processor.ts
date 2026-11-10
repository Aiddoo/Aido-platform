import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { type JobEnvelope, JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { InviteLogEvent } from "../../application/invites.log-events.js";
import { GrantInviteRewardsUseCase } from "../../application/use-cases/grant-invite-rewards.use-case.js";
import {
  INVITE_REWARD_QUEUE,
  INVITE_REWARD_WORKER_OPTIONS,
  inviteRewardJobDataSchema,
} from "./invite-reward.queue.js";

@Injectable()
export class InviteRewardProcessor implements OnModuleInit {
  readonly #logger = new Logger(InviteRewardProcessor.name);
  readonly #grantInviteRewards: Pick<GrantInviteRewardsUseCase, "execute">;
  readonly #runtime: Pick<JobRuntimePort, "work">;

  constructor(
    @Inject(GrantInviteRewardsUseCase)
    grantInviteRewards: Pick<GrantInviteRewardsUseCase, "execute">,
    runtime: JobRuntimePort,
  ) {
    this.#grantInviteRewards = grantInviteRewards;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    // 등록과 종료는 JobRuntime 수명주기가 소유한다
    await this.#runtime.work(
      INVITE_REWARD_QUEUE,
      (jobs) => this.process(jobs),
      INVITE_REWARD_WORKER_OPTIONS,
    );
  }

  async process(jobs: readonly JobEnvelope[]): Promise<void> {
    for (const job of jobs) {
      const parsed = inviteRewardJobDataSchema.safeParse(job.data);
      if (!parsed.success) {
        // 형식이 틀린 payload는 재시도해도 같으므로 버린다
        this.#logger.error({
          event: InviteLogEvent.REWARD_JOB_FAILED,
          jobId: job.id,
          reason: "invalid-payload",
        });
        continue;
      }
      try {
        // 큐 재시도는 정비 작업의 하루 단위 재시도 예산을 쓰지 않게 첫 실행만 센다
        await this.#grantInviteRewards.execute({
          redemptionId: parsed.data.redemptionId,
          countsAttempt: job.attempt === 1,
        });
      } catch (error) {
        this.#logger.error({
          event: InviteLogEvent.REWARD_JOB_FAILED,
          jobId: job.id,
          attempt: job.attempt,
          redemptionId: parsed.data.redemptionId,
          errorType: toErrorType(error),
        });
        throw error;
      }
    }
  }
}
