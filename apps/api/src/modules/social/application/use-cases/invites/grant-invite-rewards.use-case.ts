import { REDEMPTION_STATUS, REWARD_TYPE, type RewardType } from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { INVITE_REWARD_MAX_ATTEMPTS } from "../../../domain/types/invites/reward-grant.types.js";
import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { InviteNotifierPort } from "../../ports/invites/invite-notifier.port.js";
import type { InviteRedemptionRepositoryPort } from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteRewardAlertPort } from "../../ports/invites/invite-reward-alert.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import type { RewardApplierRegistry } from "../../ports/invites/reward-applier.port.js";
import type {
  RewardGrantRecord,
  RewardGrantRepositoryPort,
} from "../../ports/invites/reward-grant.repository.port.js";

export { INVITE_REWARD_MAX_ATTEMPTS };

export interface GrantInviteRewardsInput {
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

export class InviteRewardGrantFailedError extends Error {
  constructor(readonly failedCount: number) {
    super(`Invite reward grants failed: ${failedCount}`);
    this.name = "InviteRewardGrantFailedError";
  }
}

interface GrantInviteRewardsDependencies {
  readonly rewardGrantRepository: Pick<
    RewardGrantRepositoryPort,
    "findBySource" | "markApplied" | "markFailed"
  >;
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findByIdForUpdate" | "save"
  >;
  readonly rewardAppliers: RewardApplierRegistry;
  readonly notifier: Pick<InviteNotifierPort, "notifyInviteRewarded">;
  readonly alert: InviteRewardAlertPort;
  readonly inviteConfig: InviteConfigPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/**
 * 초대 수락 한 건의 보류 지급을 적용한다. 지급마다 APPLIED 조건부 갱신으로 먼저 펜싱해
 * 같은 작업이 동시에 돌거나 다시 실행돼도 한 번만 적용한다.
 * 기능이 꺼져 있으면 아무것도 적용하지 않고 원장을 그대로 둔다. 다시 켜면 정비 작업이 PENDING을
 * 다시 골라 적용하므로 꺼진 동안 쌓인 지급도 잃지 않는다.
 */
export class GrantInviteRewards {
  readonly #dependencies: GrantInviteRewardsDependencies;

  constructor(dependencies: GrantInviteRewardsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GrantInviteRewardsInput): Promise<GrantInviteRewardsResult> {
    if (!this.#dependencies.inviteConfig.isEnabled) {
      this.#dependencies.logger.log({
        event: SocialInviteLogEvent.REWARDS_SKIPPED_DISABLED,
        redemptionId: input.redemptionId,
      });
      return { appliedCount: 0, failedCount: 0 };
    }

    const capturedAt = now();
    const grants = await this.#dependencies.rewardGrantRepository.findBySource(
      "INVITE_REDEMPTION",
      input.redemptionId,
    );
    const retryable = grants.filter(
      (grant) => grant.status !== "APPLIED" && grant.attempts < INVITE_REWARD_MAX_ATTEMPTS,
    );

    let appliedCount = 0;
    let failedCount = 0;
    // 한 수락의 지급은 보상 종류 수만큼이라 순서대로 적용한다
    for (const grant of retryable) {
      const outcome = await this.#apply(grant, capturedAt, input.countsAttempt);
      if (outcome === "applied") appliedCount += 1;
      if (outcome === "failed") failedCount += 1;
    }

    const rewarded = await this.#markRewardedIfComplete(input.redemptionId, capturedAt);
    if (rewarded != null) {
      await this.#notify(input.redemptionId, rewarded);
    }

    this.#dependencies.logger.log({
      event: SocialInviteLogEvent.REWARDS_GRANTED,
      redemptionId: input.redemptionId,
      appliedCount,
      failedCount,
    });
    if (failedCount > 0) {
      // 큐가 backoff로 다시 시도하게 실패를 전파한다
      throw new InviteRewardGrantFailedError(failedCount);
    }
    return { appliedCount, failedCount };
  }

  // 펜싱과 적용을 한 UoW에 두어 적용이 실패하면 APPLIED도 함께 되돌린다
  async #apply(
    grant: RewardGrantRecord,
    at: Date,
    countsAttempt: boolean,
  ): Promise<"applied" | "already-applied" | "failed"> {
    try {
      return await this.#dependencies.unitOfWork.run(async () => {
        const isFenced = await this.#dependencies.rewardGrantRepository.markApplied(grant.id, at);
        if (!isFenced) return "already-applied" as const;
        await this.#dependencies.rewardAppliers[grant.rewardType].apply(grant);
        return "applied" as const;
      });
    } catch (error) {
      const errorCode = error instanceof ErrorCodedException ? error.errorCode : "APPLY_FAILED";
      const attempts = await this.#dependencies.rewardGrantRepository.markFailed(grant.id, {
        errorCode,
        failedAt: at,
        countsAttempt,
      });
      this.#dependencies.logger.warn({
        event: SocialInviteLogEvent.REWARD_APPLY_FAILED,
        grantId: grant.id,
        rewardType: grant.rewardType,
        attempts: attempts ?? grant.attempts,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      if (countsAttempt && attempts === INVITE_REWARD_MAX_ATTEMPTS) {
        this.#reportExhausted(grant, attempts, errorCode);
      }
      return "failed";
    }
  }

  // 정비 작업도 더는 고르지 않으므로 사람이 다시 적용할 수 있게 한 번만 알린다
  #reportExhausted(grant: RewardGrantRecord, attempts: number, errorCode: string): void {
    this.#dependencies.logger.error({
      event: SocialInviteLogEvent.REWARD_RETRY_EXHAUSTED,
      grantId: grant.id,
      redemptionId: grant.sourceId,
      rewardType: grant.rewardType,
      attempts,
      errorCode,
    });
    try {
      this.#dependencies.alert.reportRetryExhausted({
        grantId: grant.id,
        redemptionId: grant.sourceId,
        rewardType: grant.rewardType,
        attempts,
        errorCode,
      });
    } catch (error) {
      this.#dependencies.logger.warn({
        event: SocialInviteLogEvent.REWARD_RETRY_EXHAUSTED,
        grantId: grant.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  /**
   * 초대한 사람 지급이 모두 APPLIED가 되어 이번 실행이 REWARDED로 바꿨을 때만 그 지급을 반환한다.
   * 이미 REWARDED였거나 아직 남은 지급이 있으면 null이라 발자국 알림은 수락마다 한 번이다.
   */
  async #markRewardedIfComplete(
    redemptionId: string,
    at: Date,
  ): Promise<{ readonly inviterId: string; readonly grants: RewardGrantRecord[] } | null> {
    return this.#dependencies.unitOfWork.run(async () => {
      const redemption =
        await this.#dependencies.inviteRedemptionRepository.findByIdForUpdate(redemptionId);
      if (redemption == null) return null;
      const { inviterId } = redemption;
      if (redemption.status !== REDEMPTION_STATUS.QUALIFIED || inviterId == null) return null;

      const grants = await this.#dependencies.rewardGrantRepository.findBySource(
        "INVITE_REDEMPTION",
        redemptionId,
      );
      const inviterGrants = grants.filter((grant) => grant.recipientId === inviterId);
      if (!inviterGrants.every((grant) => grant.status === "APPLIED")) return null;
      if (!redemption.markRewarded(at)) return null;
      await this.#dependencies.inviteRedemptionRepository.save(redemption);
      return { inviterId, grants: inviterGrants };
    });
  }

  // 발자국 알림은 초대한 사람에게만 보낸다. 초대받은 사람은 수락 화면에서 보상을 바로 본다
  async #notify(
    redemptionId: string,
    rewarded: { readonly inviterId: string; readonly grants: readonly RewardGrantRecord[] },
  ): Promise<void> {
    if (rewarded.grants.length === 0) return;

    const quantityOf = (rewardType: RewardType) =>
      sumBy(
        rewarded.grants.filter((grant) => grant.rewardType === rewardType),
        (grant) => grant.quantity,
      );
    try {
      await this.#dependencies.notifier.notifyInviteRewarded({
        recipientId: rewarded.inviterId,
        redemptionId,
        premiumDays: quantityOf(REWARD_TYPE.PREMIUM_DAYS),
        friendSlots: quantityOf(REWARD_TYPE.FRIEND_SLOT),
      });
    } catch (error) {
      this.#dependencies.logger.warn({
        event: SocialInviteLogEvent.REWARDED_NOTIFICATION_FAILED,
        redemptionId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
