import type { InviteConfigPort } from "#api/modules/social/invites/social-invites.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { INVITE_REWARD_MAX_ATTEMPTS } from "../../domain/invite-redemptions.constants.js";
import { InviteRedemptionLogEvent } from "../invite-redemptions.log-events.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { InviteRewardSchedulerPort } from "../ports/invite-reward-scheduler.port.js";
import type { RewardGrantRepositoryPort } from "../ports/reward-grant.repository.port.js";

const INVITE_MAINTENANCE = {
  BATCH_SIZE: 500,
  // 한 번 실행을 job 만료 시간 안에 끝내고 남은 행은 다음 날 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
  // 방금 만든 지급은 아직 첫 작업이 처리 중일 수 있어 재시도에서 뺀다
  RETRY_GRACE_MINUTES: 10,
} as const;

export interface ExpireStaleRedemptionsCommand {
  readonly now: Temporal.Instant;
  /** 재시도 작업을 하루 한 번으로 합치는 실행 날짜 */
  readonly runDate: Temporal.PlainDate;
}

export interface ExpireStaleRedemptionsResult {
  readonly expiredCount: number;
  readonly retriedCount: number;
}

export interface ExpireStaleRedemptionsDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly inviteRedemptionRepository: Pick<InviteRedemptionRepositoryPort, "expireJoinedBefore">;
  readonly rewardGrantRepository: Pick<RewardGrantRepositoryPort, "listRetryableRedemptionIds">;
  readonly rewardScheduler: Pick<InviteRewardSchedulerPort, "scheduleMany">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 사용 시작 마감이 지난 수락을 거절하고, 적용하지 못한 지급의 작업을 다시 만든다. */
export class ExpireStaleRedemptionsUseCase {
  readonly #dependencies: ExpireStaleRedemptionsDependencies;

  constructor(dependencies: ExpireStaleRedemptionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ExpireStaleRedemptionsCommand): Promise<ExpireStaleRedemptionsResult> {
    const expiredCount = await this.#expire(command.now);
    // 꺼져 있는 동안은 지급하지 않고 원장을 남긴다. 다시 켠 뒤 첫 실행이 PENDING·FAILED를 이어 받는다
    const retriedCount = this.#dependencies.inviteConfig.isEnabled ? await this.#retry(command) : 0;

    this.#dependencies.logger.log({
      event: InviteRedemptionLogEvent.MAINTENANCE_COMPLETED,
      expiredCount,
      retriedCount,
    });
    return { expiredCount, retriedCount };
  }

  // 한 묶음마다 짧은 UoW로 SKIP LOCKED 잠금과 거절을 함께 커밋한다
  async #expire(now: Temporal.Instant): Promise<number> {
    const { unitOfWork, inviteRedemptionRepository } = this.#dependencies;
    let expiredCount = 0;
    for (let batch = 0; batch < INVITE_MAINTENANCE.MAX_BATCHES_PER_RUN; batch++) {
      const expired = await unitOfWork.run(() =>
        inviteRedemptionRepository.expireJoinedBefore(now, INVITE_MAINTENANCE.BATCH_SIZE),
      );
      expiredCount += expired;
      if (expired < INVITE_MAINTENANCE.BATCH_SIZE) {
        break;
      }
    }
    return expiredCount;
  }

  async #retry(command: ExpireStaleRedemptionsCommand): Promise<number> {
    const { rewardGrantRepository, rewardScheduler } = this.#dependencies;
    const createdBefore = command.now.subtract({ minutes: INVITE_MAINTENANCE.RETRY_GRACE_MINUTES });
    let afterRedemptionId: InviteRedemptionId | null = null;
    let retriedCount = 0;
    for (let batch = 0; batch < INVITE_MAINTENANCE.MAX_BATCHES_PER_RUN; batch++) {
      const redemptionIds = await rewardGrantRepository.listRetryableRedemptionIds({
        maxAttempts: INVITE_REWARD_MAX_ATTEMPTS,
        createdBefore,
        afterRedemptionId,
        limit: INVITE_MAINTENANCE.BATCH_SIZE,
      });
      await rewardScheduler.scheduleMany(redemptionIds, {
        kind: "retry",
        runDate: command.runDate,
      });
      retriedCount += redemptionIds.length;

      if (redemptionIds.length < INVITE_MAINTENANCE.BATCH_SIZE) {
        break;
      }
      afterRedemptionId = redemptionIds.at(-1) ?? null;
    }
    return retriedCount;
  }
}
