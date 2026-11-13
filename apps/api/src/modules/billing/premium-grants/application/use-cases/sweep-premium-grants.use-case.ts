import { mapAsync, sum } from "es-toolkit";

import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PremiumAccessCachePort } from "../ports/premium-access-cache.port.js";
import type { PremiumGrantRepositoryPort } from "../ports/premium-grant.repository.port.js";
import type { UserSubscriptionProjectionRepositoryPort } from "../ports/user-subscription-projection.repository.port.js";
import { PremiumGrantLogEvent } from "../premium-grants.log-events.js";
import type { ProjectPremiumAccessUseCase } from "./project-premium-access.use-case.js";

const PREMIUM_GRANT_SWEEP = {
  BATCH_SIZE: 500,
  // 한 번 실행이 job 만료 시간 안에 끝나도록 상한을 두고 남은 사용자는 다음 실행이 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
  // DB 풀(기본 10)을 다른 요청과 나눠 쓰도록 동시에 여는 UoW 수를 제한한다
  USER_CONCURRENCY: 4,
} as const;

export interface SweepPremiumGrantsCommand {
  readonly now: Temporal.Instant;
}

export interface SweepPremiumGrantsResult {
  readonly userCount: number;
  readonly changedGrantCount: number;
  readonly failedUserCount: number;
  readonly hasRemaining: boolean;
  /** 만료 웹훅 없이 프리미엄이 끝나 다시 계산한 사용자 */
  readonly lapsedUserCount: number;
  readonly lapsedFailedUserCount: number;
  readonly hasRemainingLapsed: boolean;
}

type UserReconciliation =
  | { readonly status: "done"; readonly changedGrantCount: number }
  | { readonly status: "failed" };

interface SweepBatchResult {
  readonly userCount: number;
  readonly changedGrantCount: number;
  readonly failedUserCount: number;
  readonly hasRemaining: boolean;
}

type ListUserIdsPage = (page: {
  readonly now: Temporal.Instant;
  readonly afterUserId?: UserId;
  readonly limit: number;
}) => Promise<UserId[]>;

export interface SweepPremiumGrantsDependencies {
  readonly premiumGrantRepository: Pick<PremiumGrantRepositoryPort, "listUserIdsToReconcile">;
  readonly userSubscriptionProjection: Pick<
    UserSubscriptionProjectionRepositoryPort,
    "listLapsedPremiumUserIds"
  >;
  readonly projectPremiumAccess: Pick<ProjectPremiumAccessUseCase, "execute">;
  readonly userLock: Pick<UserMutationLockPort, "lockById">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cache: PremiumAccessCachePort;
  readonly logger: ApplicationLoggerPort;
}

/**
 * 끝난 보상 기간을 닫고 스토어가 끝난 사용자의 쌓인 기간을 시작한다.
 * 만료 웹훅을 잃어 User projection만 ACTIVE로 남은 사용자도 같은 계산으로 다시 정리한다.
 */
export class SweepPremiumGrantsUseCase {
  readonly #dependencies: SweepPremiumGrantsDependencies;

  constructor(dependencies: SweepPremiumGrantsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SweepPremiumGrantsCommand): Promise<SweepPremiumGrantsResult> {
    const { premiumGrantRepository, userSubscriptionProjection, logger } = this.#dependencies;
    const grants = await this.#sweep(command.now, (page) =>
      premiumGrantRepository.listUserIdsToReconcile(page),
    );
    logger.log({
      event: PremiumGrantLogEvent.PREMIUM_GRANT_SWEPT,
      userCount: grants.userCount,
      changedGrantCount: grants.changedGrantCount,
      failedUserCount: grants.failedUserCount,
      hasRemaining: grants.hasRemaining,
    });

    // 보상 기간 정리가 먼저 끝나야 남은 ACTIVE projection이 실제로 끝난 사용자만 남는다
    const lapsed = await this.#sweep(command.now, (page) =>
      userSubscriptionProjection.listLapsedPremiumUserIds(page),
    );
    logger.log({
      event: PremiumGrantLogEvent.LAPSED_PREMIUM_SWEPT,
      userCount: lapsed.userCount,
      failedUserCount: lapsed.failedUserCount,
      hasRemaining: lapsed.hasRemaining,
    });

    return {
      ...grants,
      lapsedUserCount: lapsed.userCount,
      lapsedFailedUserCount: lapsed.failedUserCount,
      hasRemainingLapsed: lapsed.hasRemaining,
    };
  }

  async #sweep(now: Temporal.Instant, listUserIds: ListUserIdsPage): Promise<SweepBatchResult> {
    let afterUserId: UserId | undefined;
    let userCount = 0;
    let changedGrantCount = 0;
    let failedUserCount = 0;
    let hasRemaining = false;

    for (let batch = 0; batch < PREMIUM_GRANT_SWEEP.MAX_BATCHES_PER_RUN; batch++) {
      // 처리한 사용자는 조건에서 빠지지만 잠금 실패 등으로 남아도 keyset이 앞으로만 나아간다
      const userIds = await listUserIds({
        now,
        ...(afterUserId != null && { afterUserId }),
        limit: PREMIUM_GRANT_SWEEP.BATCH_SIZE,
      });

      const results = await mapAsync(userIds, (userId) => this.#reconcileUser(userId, now), {
        concurrency: PREMIUM_GRANT_SWEEP.USER_CONCURRENCY,
      });
      userCount += userIds.length;
      changedGrantCount += sum(
        results.map((result) => (result.status === "done" ? result.changedGrantCount : 0)),
      );
      failedUserCount += results.filter((result) => result.status === "failed").length;

      hasRemaining = userIds.length === PREMIUM_GRANT_SWEEP.BATCH_SIZE;
      if (!hasRemaining) {
        break;
      }
      afterUserId = userIds.at(-1);
    }
    return { userCount, changedGrantCount, failedUserCount, hasRemaining };
  }

  // 사용자마다 짧은 UoW에서 웹훅과 같은 사용자 잠금을 잡는다. 한 사용자의 실패가 나머지를 막지 않고 다음 실행이 다시 고른다
  async #reconcileUser(userId: UserId, now: Temporal.Instant): Promise<UserReconciliation> {
    let changedGrantCount: number;
    try {
      changedGrantCount = await this.#dependencies.unitOfWork.run(async () => {
        if (!(await this.#dependencies.userLock.lockById(userId))) {
          return 0;
        }
        const projected = await this.#dependencies.projectPremiumAccess.execute({ userId, now });
        return projected.changedGrantCount;
      });
    } catch (error) {
      this.#dependencies.logger.error({
        event: PremiumGrantLogEvent.PREMIUM_GRANT_RECONCILE_FAILED,
        userId: userId.value,
        errorType: toErrorType(error),
      });
      return { status: "failed" };
    }

    try {
      await this.#dependencies.cache.invalidate(userId);
    } catch (error) {
      this.#dependencies.logger.warn({
        event: PremiumGrantLogEvent.PREMIUM_GRANT_CACHE_INVALIDATION_FAILED,
        userId: userId.value,
        errorType: toErrorType(error),
      });
    }
    return { status: "done", changedGrantCount };
  }
}
