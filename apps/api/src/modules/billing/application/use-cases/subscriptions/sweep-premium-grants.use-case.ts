import { mapAsync, sum } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { BillingLogEvent } from "../../observability/subscriptions/billing-log.events.js";
import type { PremiumGrantRepositoryPort } from "../../ports/subscriptions/premium-grant.repository.port.js";
import type { SubscriptionCachePort } from "../../ports/subscriptions/subscription-cache.port.js";
import type { SubscriptionUserMutationLockPort } from "../../ports/subscriptions/subscription-user-mutation-lock.port.js";
import type { PremiumAccessProjector } from "../../services/subscriptions/premium-access-projector.service.js";

export const PREMIUM_GRANT_SWEEP = {
  BATCH_SIZE: 500,
  // 한 번 실행이 job 만료 시간 안에 끝나도록 상한을 두고 남은 사용자는 다음 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
  // DB 풀(기본 10)을 다른 요청과 나눠 쓰도록 동시에 여는 UoW 수를 제한한다
  USER_CONCURRENCY: 4,
} as const;

export interface SweepPremiumGrantsInput {
  readonly now: Date;
}

export interface SweepPremiumGrantsResult {
  readonly userCount: number;
  readonly changedGrantCount: number;
  readonly failedUserCount: number;
  readonly hasRemaining: boolean;
}

type UserReconciliation =
  | { readonly status: "done"; readonly changedGrantCount: number }
  | { readonly status: "failed" };

interface SweepPremiumGrantsDependencies {
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "findUserIdsToReconcile">;
  readonly premiumAccessProjector: Pick<PremiumAccessProjector, "project">;
  readonly userMutationLock: SubscriptionUserMutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cache: SubscriptionCachePort;
  readonly logger: ApplicationLogger;
}

/** 끝난 보상 기간을 닫고 스토어가 끝난 사용자의 쌓인 기간을 시작한다. */
export class SweepPremiumGrants {
  readonly #dependencies: SweepPremiumGrantsDependencies;

  constructor(dependencies: SweepPremiumGrantsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SweepPremiumGrantsInput): Promise<SweepPremiumGrantsResult> {
    let afterUserId: string | undefined;
    let userCount = 0;
    let changedGrantCount = 0;
    let failedUserCount = 0;
    let hasRemaining = false;

    for (let batch = 0; batch < PREMIUM_GRANT_SWEEP.MAX_BATCHES_PER_RUN; batch++) {
      // 처리한 사용자는 조건에서 빠지지만 잠금 실패 등으로 남아도 keyset이 앞으로만 나아간다
      const userIds = await this.#dependencies.premiumGrantRepository.findUserIdsToReconcile({
        now: input.now,
        afterUserId,
        limit: PREMIUM_GRANT_SWEEP.BATCH_SIZE,
      });

      const results = await mapAsync(userIds, (userId) => this.#reconcileUser(userId, input.now), {
        concurrency: PREMIUM_GRANT_SWEEP.USER_CONCURRENCY,
      });
      userCount += userIds.length;
      changedGrantCount += sum(
        results.map((result) => (result.status === "done" ? result.changedGrantCount : 0)),
      );
      failedUserCount += results.filter((result) => result.status === "failed").length;

      hasRemaining = userIds.length === PREMIUM_GRANT_SWEEP.BATCH_SIZE;
      if (!hasRemaining) break;
      afterUserId = userIds.at(-1);
    }

    this.#dependencies.logger.log({
      event: BillingLogEvent.PREMIUM_GRANT_SWEPT,
      userCount,
      changedGrantCount,
      failedUserCount,
      hasRemaining,
    });
    return { userCount, changedGrantCount, failedUserCount, hasRemaining };
  }

  // 사용자마다 짧은 UoW에서 웹훅과 같은 사용자 잠금을 잡는다. 한 사용자의 실패가 나머지를 막지 않고 다음 실행이 다시 고른다
  async #reconcileUser(userId: string, now: Date): Promise<UserReconciliation> {
    let changedGrantCount: number;
    try {
      changedGrantCount = await this.#dependencies.unitOfWork.run(async () => {
        if (!(await this.#dependencies.userMutationLock.lockById(userId))) {
          return 0;
        }
        const projection = await this.#dependencies.premiumAccessProjector.project({ userId, now });
        return projection.changedGrantCount;
      });
    } catch (error) {
      this.#dependencies.logger.error({
        event: BillingLogEvent.PREMIUM_GRANT_RECONCILE_FAILED,
        userId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return { status: "failed" };
    }

    try {
      await this.#dependencies.cache.invalidate(userId);
    } catch (error) {
      this.#dependencies.logger.warn({
        event: BillingLogEvent.PREMIUM_GRANT_CACHE_INVALIDATION_FAILED,
        userId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
    return { status: "done", changedGrantCount };
  }
}
