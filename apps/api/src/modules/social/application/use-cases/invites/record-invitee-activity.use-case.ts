import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import {
  MutationLockKeys,
  type MutationLockPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import type { InviteRedemption } from "../../../domain/aggregates/invites/invite-redemption.aggregate.js";
import {
  InviteQualificationPolicy,
  localActivityDate,
} from "../../../domain/policies/invites/invite-qualification.policy.js";
import {
  InviteRewardPolicy,
  qualifiedRedemptionCount,
  rewardCapWindowStart,
} from "../../../domain/policies/invites/invite-reward.policy.js";
import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { InviteRedemptionRepositoryPort } from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteRewardSchedulerPort } from "../../ports/invites/invite-reward.scheduler.port.js";
import type { RewardGrantRepositoryPort } from "../../ports/invites/reward-grant.repository.port.js";

export interface RecordInviteeActivityInput {
  readonly inviteeId: string;
  readonly timezone: string;
  readonly occurredAt: Date;
}

export type RecordInviteeActivityResult =
  | { readonly status: "skipped" }
  | { readonly status: "recorded" }
  | { readonly status: "qualified"; readonly redemptionId: string; readonly grantCount: number };

interface RecordInviteeActivityDependencies {
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "hasJoinedByInviteeId" | "findByInviteeIdForUpdate" | "save" | "summarizeByInviterId"
  >;
  readonly rewardGrantRepository: Pick<
    RewardGrantRepositoryPort,
    "summarizeInviterRewards" | "createPending"
  >;
  readonly rewardScheduler: InviteRewardSchedulerPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/** 초대받은 사람이 할 일을 마친 날짜를 모아 사용 시작을 판정하고 초대한 사람 보상을 남긴다. */
export class RecordInviteeActivity {
  readonly #dependencies: RecordInviteeActivityDependencies;

  constructor(dependencies: RecordInviteeActivityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RecordInviteeActivityInput): Promise<RecordInviteeActivityResult> {
    // 할 일 토글마다 불리므로 대부분은 UNIQUE 인덱스 한 번으로 끝난다
    if (
      !(await this.#dependencies.inviteRedemptionRepository.hasJoinedByInviteeId(input.inviteeId))
    ) {
      return { status: "skipped" };
    }

    const localDate = localActivityDate(input.occurredAt, input.timezone);
    const result = await this.#dependencies.unitOfWork.run(async () => {
      const redemption =
        await this.#dependencies.inviteRedemptionRepository.findByInviteeIdForUpdate(
          input.inviteeId,
        );
      if (redemption === null || !redemption.recordActiveDay(localDate, input.occurredAt)) {
        return { status: "skipped" } as const;
      }
      if (!InviteQualificationPolicy.isQualified(redemption) || redemption.inviterId === null) {
        await this.#dependencies.inviteRedemptionRepository.save(redemption);
        return { status: "recorded" } as const;
      }

      return this.#qualify(redemption, redemption.inviterId, input.occurredAt);
    });

    if (result.status === "qualified") {
      this.#dependencies.logger.log({
        event: SocialInviteLogEvent.QUALIFIED,
        redemptionId: result.redemptionId,
        inviteeId: input.inviteeId,
        grantCount: result.grantCount,
      });
    }
    return result;
  }

  async #qualify(
    redemption: InviteRedemption,
    inviterId: string,
    at: Date,
  ): Promise<RecordInviteeActivityResult> {
    // 같은 초대한 사람의 상한을 여러 초대받은 사람이 동시에 읽지 않도록 잠근다
    await this.#dependencies.mutationLock.acquire([MutationLockKeys.inviteRewardLedger(inviterId)]);
    const [rewardTotals, summary] = await Promise.all([
      this.#dependencies.rewardGrantRepository.summarizeInviterRewards(
        inviterId,
        rewardCapWindowStart(at),
      ),
      this.#dependencies.inviteRedemptionRepository.summarizeByInviterId(inviterId),
    ]);

    // 상한에 닿아도 사용 시작은 인정하고 지급할 보상만 줄인다
    const plans = InviteRewardPolicy.planInviterRewards(redemption, {
      inviterId,
      summary: InviteRewardPolicy.summarize(rewardTotals),
      priorQualifiedCount: qualifiedRedemptionCount(summary),
    });

    redemption.qualify(at);
    await this.#dependencies.inviteRedemptionRepository.save(redemption);
    const grantCount = await this.#dependencies.rewardGrantRepository.createPending(plans);
    await this.#dependencies.rewardScheduler.schedule(redemption.id, { kind: "qualified" });
    return { status: "qualified", redemptionId: redemption.id, grantCount };
  }
}
