import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import {
  JOB_RUNTIME,
  type JobEnvelope,
  type JobRuntimePort,
} from "#api/shared/application/ports/job-runtime.port";

import { SocialInviteLogEvent } from "../../../application/observability/invites/social-invite-log.events.js";
import { GrantInviteRewards } from "../../../application/use-cases/invites/grant-invite-rewards.use-case.js";
import {
  INVITE_REWARD_QUEUE,
  INVITE_REWARD_WORKER_OPTIONS,
  inviteRewardJobDataSchema,
  type InviteRewardJobData,
} from "./invite-reward-queue.constants.js";

@Injectable()
export class InviteRewardProcessor implements OnModuleInit {
  readonly #logger = new Logger(InviteRewardProcessor.name);

  constructor(
    @Inject(GrantInviteRewards)
    private readonly grantInviteRewards: Pick<GrantInviteRewards, "execute">,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    // 등록과 종료는 JobRuntime 수명주기가 소유한다
    await this.runtime.work<InviteRewardJobData>(
      INVITE_REWARD_QUEUE,
      (jobs) => this.process(jobs),
      INVITE_REWARD_WORKER_OPTIONS,
    );
  }

  async process(jobs: readonly JobEnvelope<InviteRewardJobData>[]): Promise<void> {
    for (const job of jobs) {
      const parsed = inviteRewardJobDataSchema.safeParse(job.data);
      if (!parsed.success) {
        // 형식이 틀린 payload는 재시도해도 같으므로 버린다
        this.#logger.error({
          event: SocialInviteLogEvent.REWARD_JOB_FAILED,
          jobId: job.id,
          reason: "invalid-payload",
        });
        continue;
      }
      try {
        await this.grantInviteRewards.execute(parsed.data);
      } catch (error) {
        this.#logger.error({
          event: SocialInviteLogEvent.REWARD_JOB_FAILED,
          jobId: job.id,
          attempt: job.attempt,
          redemptionId: parsed.data.redemptionId,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        throw error;
      }
    }
  }
}
