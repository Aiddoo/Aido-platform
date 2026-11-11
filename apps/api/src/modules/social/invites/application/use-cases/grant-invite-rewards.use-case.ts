import { isErrorCode } from "@aido/api/errors";
import { REDEMPTION_STATUS, REWARD_TYPE, type RewardType } from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { INVITE_REWARD_MAX_ATTEMPTS } from "../../domain/invites.constants.js";
import type { RewardGrant } from "../../domain/reward-grant.entity.js";
import { InviteAlerts } from "../invites.alerts.js";
import { InviteLogEvent } from "../invites.log-events.js";
import type { InviteConfigPort } from "../ports/invite-config.port.js";
import type { InviteNotifierPort } from "../ports/invite-notifier.port.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { RewardApplierPort } from "../ports/reward-applier.port.js";
import type { RewardGrantRepositoryPort } from "../ports/reward-grant.repository.port.js";

export interface GrantInviteRewardsCommand {
  readonly redemptionId: string;
  /**
   * 지급 작업의 첫 실행인지. 큐 재시도까지 시도 횟수로 세면 몇 분 만에 하루 단위 정비 재시도 예산을
   * 다 써 버리므로 첫 실행만 센다.
   */
  readonly countsAttempt: boolean;
}

export interface GrantInviteRewardsResult {
  readonly appliedCount: number;
  readonly failedCount: number;
}

/** 큐가 backoff로 다시 시도하게 지급 작업을 실패시킨다. */
class InviteRewardGrantFailedError extends Error {
  readonly failedCount: number;

  constructor(failedCount: number) {
    super(`Invite reward grants failed: ${failedCount}`);
    this.failedCount = failedCount;
    this.name = "InviteRewardGrantFailedError";
  }
}

type GrantOutcome = "applied" | "already-applied" | "failed";

interface RewardedRedemption {
  readonly inviterId: UserId;
  readonly grants: readonly RewardGrant[];
}

export interface GrantInviteRewardsDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly rewardGrantRepository: Pick<
    RewardGrantRepositoryPort,
    "listByRedemptionId" | "markApplied" | "markFailed"
  >;
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findByIdForUpdate" | "save"
  >;
  readonly rewardApplier: Pick<RewardApplierPort, "apply">;
  readonly notifier: Pick<InviteNotifierPort, "notifyInviteRewarded">;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn" | "error">;
}

/**
 * 초대 수락 한 건의 보류 지급을 적용한다. 지급마다 APPLIED 조건부 갱신으로 먼저 펜싱해
 * 같은 작업이 동시에 돌거나 다시 실행돼도 한 번만 적용한다.
 * 기능이 꺼져 있으면 아무것도 적용하지 않고 원장을 그대로 둔다. 다시 켜면 정비 작업이 PENDING을
 * 다시 골라 적용하므로 꺼진 동안 쌓인 지급도 잃지 않는다.
 */
export class GrantInviteRewardsUseCase {
  readonly #dependencies: GrantInviteRewardsDependencies;

  constructor(dependencies: GrantInviteRewardsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: GrantInviteRewardsCommand): Promise<GrantInviteRewardsResult> {
    const { rewardGrantRepository, inviteConfig, clock, logger } = this.#dependencies;
    if (!inviteConfig.isEnabled) {
      logger.log({
        event: InviteLogEvent.REWARDS_SKIPPED_DISABLED,
        redemptionId: command.redemptionId,
      });
      return { appliedCount: 0, failedCount: 0 };
    }

    const redemptionId = InviteRedemptionId.reconstitute(command.redemptionId);
    const now = clock.now();
    const grants = await rewardGrantRepository.listByRedemptionId(redemptionId);

    let appliedCount = 0;
    let failedCount = 0;
    // 한 수락의 지급은 보상 종류 수만큼이라 순서대로 적용한다
    for (const grant of grants.filter((candidate) => candidate.isRetryable())) {
      const outcome = await this.#apply(grant, now, command.countsAttempt);
      if (outcome === "applied") {
        appliedCount += 1;
      }
      if (outcome === "failed") {
        failedCount += 1;
      }
    }

    const rewarded = await this.#markRewardedIfComplete(redemptionId, now);
    if (rewarded != null) {
      await this.#notify(redemptionId, rewarded);
    }

    logger.log({
      event: InviteLogEvent.REWARDS_GRANTED,
      redemptionId: command.redemptionId,
      appliedCount,
      failedCount,
    });
    if (failedCount > 0) {
      throw new InviteRewardGrantFailedError(failedCount);
    }
    return { appliedCount, failedCount };
  }

  // 펜싱과 적용을 한 UoW에 두어 적용이 실패하면 APPLIED도 함께 되돌린다
  async #apply(
    grant: RewardGrant,
    now: Temporal.Instant,
    countsAttempt: boolean,
  ): Promise<GrantOutcome> {
    const { unitOfWork, rewardGrantRepository, rewardApplier, logger } = this.#dependencies;
    try {
      return await unitOfWork.run(async (): Promise<GrantOutcome> => {
        if (!(await rewardGrantRepository.markApplied(grant.id, now))) {
          return "already-applied";
        }
        await rewardApplier.apply(grant);
        return "applied";
      });
    } catch (error) {
      const errorCode = error instanceof ErrorCodedException ? error.errorCode : "APPLY_FAILED";
      const attempts = await rewardGrantRepository.markFailed(grant.id, {
        errorCode,
        failedAt: now,
        countsAttempt,
      });
      logger.warn({
        event: InviteLogEvent.REWARD_APPLY_FAILED,
        grantId: grant.id.value,
        rewardType: grant.rewardType,
        attempts: attempts ?? grant.attempts,
        errorType: toErrorType(error),
      });
      if (countsAttempt && attempts === INVITE_REWARD_MAX_ATTEMPTS) {
        this.#reportExhausted(grant, attempts, errorCode);
      }
      return "failed";
    }
  }

  // 정비 작업도 더는 고르지 않으므로 사람이 다시 적용할 수 있게 한 번만 알린다
  #reportExhausted(grant: RewardGrant, attempts: number, errorCode: string): void {
    this.#dependencies.logger.error({
      event: InviteLogEvent.REWARD_RETRY_EXHAUSTED,
      grantId: grant.id.value,
      redemptionId: grant.sourceId,
      rewardType: grant.rewardType,
      attempts,
      ...(isErrorCode(errorCode) ? { errorCode } : { errorType: errorCode }),
    });
    this.#dependencies.alert.raise({
      ...InviteAlerts.REWARD_RETRY_EXHAUSTED,
      tags: { errorCode },
      details: {
        grantId: grant.id.value,
        redemptionId: grant.sourceId,
        rewardType: grant.rewardType,
        attempts,
      },
    });
  }

  /**
   * 초대한 사람 지급이 모두 APPLIED가 되어 이번 실행이 REWARDED로 바꿨을 때만 그 지급을 반환한다.
   * 이미 REWARDED였거나 아직 남은 지급이 있으면 null이라 발자국 알림은 수락마다 한 번이다.
   */
  async #markRewardedIfComplete(
    redemptionId: InviteRedemptionId,
    now: Temporal.Instant,
  ): Promise<RewardedRedemption | null> {
    const { unitOfWork, inviteRedemptionRepository, rewardGrantRepository } = this.#dependencies;
    return unitOfWork.run(async () => {
      const redemption = await inviteRedemptionRepository.findByIdForUpdate(redemptionId);
      const inviterId = redemption?.inviterId;
      if (
        redemption == null ||
        inviterId == null ||
        redemption.status !== REDEMPTION_STATUS.QUALIFIED
      ) {
        return null;
      }

      const grants = await rewardGrantRepository.listByRedemptionId(redemptionId);
      const inviterGrants = grants.filter((grant) => grant.isFor(inviterId));
      if (!inviterGrants.every((grant) => grant.isApplied())) {
        return null;
      }
      if (!redemption.markRewarded(now)) {
        return null;
      }
      await inviteRedemptionRepository.save(redemption);
      return { inviterId, grants: inviterGrants };
    });
  }

  // 발자국 알림은 초대한 사람에게만 보낸다. 초대받은 사람은 수락 화면에서 보상을 바로 본다
  async #notify(redemptionId: InviteRedemptionId, rewarded: RewardedRedemption): Promise<void> {
    if (rewarded.grants.length === 0) {
      return;
    }

    const quantityOf = (rewardType: RewardType) =>
      sumBy(
        rewarded.grants.filter((grant) => grant.rewardType === rewardType),
        (grant) => grant.quantity,
      );
    try {
      await this.#dependencies.notifier.notifyInviteRewarded({
        recipientId: rewarded.inviterId.value,
        redemptionId: redemptionId.value,
        premiumDays: quantityOf(REWARD_TYPE.PREMIUM_DAYS),
        friendSlots: quantityOf(REWARD_TYPE.FRIEND_SLOT),
      });
    } catch (error) {
      this.#dependencies.logger.warn({
        event: InviteLogEvent.REWARDED_NOTIFICATION_FAILED,
        redemptionId: redemptionId.value,
        errorType: toErrorType(error),
      });
    }
  }
}
