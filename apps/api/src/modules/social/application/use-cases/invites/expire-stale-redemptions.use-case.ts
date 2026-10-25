import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { subtractMinutes } from "#api/shared/domain/date/utils/arithmetic";

import { INVITE_REWARD_MAX_ATTEMPTS } from "../../../domain/types/invites/reward-grant.types.js";
import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { InviteRedemptionRepositoryPort } from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteRewardSchedulerPort } from "../../ports/invites/invite-reward.scheduler.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import type { RewardGrantRepositoryPort } from "../../ports/invites/reward-grant.repository.port.js";

const INVITE_MAINTENANCE = {
  BATCH_SIZE: 500,
  // 한 번 실행을 job 만료 시간 안에 끝내고 남은 행은 다음 날 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
  // 방금 만든 지급은 아직 첫 작업이 처리 중일 수 있어 재시도에서 뺀다
  RETRY_GRACE_MINUTES: 10,
} as const;

export interface ExpireStaleRedemptionsInput {
  readonly now: Date;
  /** 재시도 작업을 하루 한 번으로 합치는 실행 날짜 (YYYY-MM-DD) */
  readonly runDate: string;
}

export interface ExpireStaleRedemptionsResult {
  readonly expiredCount: number;
  readonly retriedCount: number;
}

interface ExpireStaleRedemptionsDependencies {
  readonly inviteRedemptionRepository: Pick<InviteRedemptionRepositoryPort, "expireJoinedBefore">;
  readonly rewardGrantRepository: Pick<RewardGrantRepositoryPort, "findRetryableSourceIds">;
  readonly rewardScheduler: Pick<InviteRewardSchedulerPort, "scheduleMany">;
  readonly inviteConfig: InviteConfigPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/** 사용 시작 마감이 지난 수락을 거절하고, 적용하지 못한 지급의 작업을 다시 만든다. */
export class ExpireStaleRedemptions {
  readonly #dependencies: ExpireStaleRedemptionsDependencies;

  constructor(dependencies: ExpireStaleRedemptionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ExpireStaleRedemptionsInput): Promise<ExpireStaleRedemptionsResult> {
    const expiredCount = await this.#expire(input.now);
    // 꺼져 있는 동안은 지급하지 않고 원장을 남긴다. 다시 켠 뒤 첫 실행이 PENDING·FAILED를 이어 받는다
    const retriedCount = this.#dependencies.inviteConfig.isEnabled ? await this.#retry(input) : 0;

    this.#dependencies.logger.log({
      event: SocialInviteLogEvent.MAINTENANCE_COMPLETED,
      expiredCount,
      retriedCount,
    });
    return { expiredCount, retriedCount };
  }

  // 한 묶음마다 짧은 UoW로 SKIP LOCKED 잠금과 거절을 함께 커밋한다
  async #expire(now: Date): Promise<number> {
    let expiredCount = 0;
    for (let batch = 0; batch < INVITE_MAINTENANCE.MAX_BATCHES_PER_RUN; batch++) {
      const expired = await this.#dependencies.unitOfWork.run(() =>
        this.#dependencies.inviteRedemptionRepository.expireJoinedBefore(
          now,
          INVITE_MAINTENANCE.BATCH_SIZE,
        ),
      );
      expiredCount += expired;
      if (expired < INVITE_MAINTENANCE.BATCH_SIZE) break;
    }
    return expiredCount;
  }

  async #retry(input: ExpireStaleRedemptionsInput): Promise<number> {
    let afterSourceId: string | undefined;
    let retriedCount = 0;
    for (let batch = 0; batch < INVITE_MAINTENANCE.MAX_BATCHES_PER_RUN; batch++) {
      const redemptionIds = await this.#dependencies.rewardGrantRepository.findRetryableSourceIds({
        maxAttempts: INVITE_REWARD_MAX_ATTEMPTS,
        createdBefore: subtractMinutes(INVITE_MAINTENANCE.RETRY_GRACE_MINUTES, input.now),
        afterSourceId,
        limit: INVITE_MAINTENANCE.BATCH_SIZE,
      });
      await this.#dependencies.rewardScheduler.scheduleMany(redemptionIds, {
        kind: "retry",
        localDate: input.runDate,
      });
      retriedCount += redemptionIds.length;

      if (redemptionIds.length < INVITE_MAINTENANCE.BATCH_SIZE) break;
      afterSourceId = redemptionIds.at(-1);
    }
    return retriedCount;
  }
}
