import { REWARD_TYPE, type RewardType } from "@aido/api/vocabulary";
import { sumBy } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { InviteNotifierPort } from "../../ports/invites/invite-notifier.port.js";
import type { InviteRedemptionRepositoryPort } from "../../ports/invites/invite-redemption.repository.port.js";
import type { RewardApplierRegistry } from "../../ports/invites/reward-applier.port.js";
import type {
  RewardGrantRecord,
  RewardGrantRepositoryPort,
} from "../../ports/invites/reward-grant.repository.port.js";

/** 이 횟수만큼 실패한 지급은 자동으로 다시 시도하지 않는다. */
export const INVITE_REWARD_MAX_ATTEMPTS = 5;

export interface GrantInviteRewardsInput {
  readonly redemptionId: string;
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
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/**
 * 초대 수락 한 건의 보류 지급을 적용한다. 지급마다 APPLIED 조건부 갱신으로 먼저 펜싱해
 * 같은 작업이 동시에 돌거나 다시 실행돼도 한 번만 적용한다.
 */
export class GrantInviteRewards {
  readonly #dependencies: GrantInviteRewardsDependencies;

  constructor(dependencies: GrantInviteRewardsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GrantInviteRewardsInput): Promise<GrantInviteRewardsResult> {
    const capturedAt = now();
    const grants = await this.#dependencies.rewardGrantRepository.findBySource(
      "INVITE_REDEMPTION",
      input.redemptionId,
    );
    const retryable = grants.filter(
      (grant) => grant.status !== "APPLIED" && grant.attempts < INVITE_REWARD_MAX_ATTEMPTS,
    );

    const applied: RewardGrantRecord[] = [];
    let failedCount = 0;
    // 한 수락의 지급은 보상 종류 수만큼이라 순서대로 적용한다
    for (const grant of retryable) {
      const outcome = await this.#apply(grant, capturedAt);
      if (outcome === "applied") applied.push(grant);
      if (outcome === "failed") failedCount += 1;
    }

    const inviterId = await this.#markRewardedIfComplete(input.redemptionId, capturedAt);
    await this.#notify(input.redemptionId, inviterId, applied);

    this.#dependencies.logger.log({
      event: SocialInviteLogEvent.REWARDS_GRANTED,
      redemptionId: input.redemptionId,
      appliedCount: applied.length,
      failedCount,
    });
    if (failedCount > 0) {
      // 큐가 backoff로 다시 시도하게 실패를 전파한다
      throw new InviteRewardGrantFailedError(failedCount);
    }
    return { appliedCount: applied.length, failedCount };
  }

  // 펜싱과 적용을 한 UoW에 두어 적용이 실패하면 APPLIED도 함께 되돌린다
  async #apply(
    grant: RewardGrantRecord,
    at: Date,
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
      await this.#dependencies.rewardGrantRepository.markFailed(grant.id, errorCode, at);
      this.#dependencies.logger.warn({
        event: SocialInviteLogEvent.REWARD_APPLY_FAILED,
        grantId: grant.id,
        rewardType: grant.rewardType,
        attempts: grant.attempts + 1,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return "failed";
    }
  }

  /** 초대한 사람 userId를 반환한다. 탈퇴했거나 수락이 없으면 null이다. */
  async #markRewardedIfComplete(redemptionId: string, at: Date): Promise<string | null> {
    return this.#dependencies.unitOfWork.run(async () => {
      const redemption =
        await this.#dependencies.inviteRedemptionRepository.findByIdForUpdate(redemptionId);
      if (redemption === null) return null;
      if (redemption.status !== "QUALIFIED" || redemption.inviterId === null) {
        return redemption.inviterId;
      }

      const grants = await this.#dependencies.rewardGrantRepository.findBySource(
        "INVITE_REDEMPTION",
        redemptionId,
      );
      const inviterGrants = grants.filter((grant) => grant.recipientId === redemption.inviterId);
      if (inviterGrants.every((grant) => grant.status === "APPLIED")) {
        redemption.markRewarded(at);
        await this.#dependencies.inviteRedemptionRepository.save(redemption);
      }
      return redemption.inviterId;
    });
  }

  // 발자국 알림은 초대한 사람에게만 보낸다. 초대받은 사람은 수락 화면에서 보상을 바로 본다
  async #notify(
    redemptionId: string,
    inviterId: string | null,
    applied: readonly RewardGrantRecord[],
  ): Promise<void> {
    const inviterGrants = applied.filter((grant) => grant.recipientId === inviterId);
    if (inviterId === null || inviterGrants.length === 0) return;

    const quantityOf = (rewardType: RewardType) =>
      sumBy(
        inviterGrants.filter((grant) => grant.rewardType === rewardType),
        (grant) => grant.quantity,
      );
    try {
      await this.#dependencies.notifier.notifyInviteRewarded({
        recipientId: inviterId,
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
