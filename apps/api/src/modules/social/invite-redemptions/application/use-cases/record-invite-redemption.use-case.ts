import { REWARD_TYPE } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import type { InviteId } from "../../../shared/domain/invite-id.vo.js";
import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";
import {
  planInviteeRewards,
  type RewardAmount,
  type RewardGrantPlan,
} from "../../domain/invite-reward.domain-service.js";
import type { RewardClaim } from "../../domain/reward-claim.entity.js";
import { RewardGrantId } from "../../domain/reward-grant-id.vo.js";
import { RewardGrant } from "../../domain/reward-grant.entity.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { InviteRewardSchedulerPort } from "../ports/invite-reward-scheduler.port.js";
import type { RewardApplierPort } from "../ports/reward-applier.port.js";
import type { RewardClaimRepositoryPort } from "../ports/reward-claim.repository.port.js";
import type { RewardGrantRepositoryPort } from "../ports/reward-grant.repository.port.js";

export interface RecordInviteRedemptionCommand {
  readonly inviteId: InviteId;
  readonly inviterId: UserId;
  readonly inviteeId: UserId;
  readonly claims: readonly RewardClaim[];
  readonly rewardEligible: boolean;
  readonly timeZone: TimeZone;
  readonly now: Temporal.Instant;
}

export interface RecordInviteRedemptionResult {
  readonly redemptionId: InviteRedemptionId;
  readonly rewards: readonly RewardAmount[];
}

export interface RecordInviteRedemptionDependencies {
  readonly inviteRedemptionRepository: Pick<InviteRedemptionRepositoryPort, "save">;
  readonly rewardClaimRepository: Pick<RewardClaimRepositoryPort, "claimAll">;
  readonly rewardGrantRepository: Pick<
    RewardGrantRepositoryPort,
    "addPending" | "listByRedemptionId" | "markApplied"
  >;
  readonly rewardApplier: Pick<RewardApplierPort, "apply">;
  readonly rewardScheduler: Pick<InviteRewardSchedulerPort, "schedule">;
}

// 초대 수락 잠금 안에서 부른다. 수락을 남기고 초대받은 사람 보상을 원장에 쌓아 같은 트랜잭션으로 커밋한다
export class RecordInviteRedemptionUseCase {
  readonly #dependencies: RecordInviteRedemptionDependencies;

  constructor(dependencies: RecordInviteRedemptionDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RecordInviteRedemptionCommand): Promise<RecordInviteRedemptionResult> {
    const { inviteRedemptionRepository, rewardClaimRepository, rewardScheduler } =
      this.#dependencies;
    const { inviteeId, now } = command;
    // 동시에 같은 기기로 수락하면 기기 해시 INSERT에서 한 번만 이긴다. 수락 행이 충돌하면
    // 저장이 INVITE_2104로 실패해 트랜잭션과 함께 claim도 되돌아간다
    const isRewardClaimed =
      command.rewardEligible && (await rewardClaimRepository.claimAll(command.claims));
    const redemption = InviteRedemption.create({
      id: InviteRedemptionId.generate(),
      inviteId: command.inviteId,
      inviterId: command.inviterId,
      inviteeId,
      timeZone: command.timeZone,
      // 같은 기기·신원으로 이미 받은 수락은 부계정으로 초대한 사람 보상을 쌓지 못하게 함께 막는다
      inviterRewardEligible: isRewardClaimed,
      now,
    });
    await inviteRedemptionRepository.save(redemption);
    const { rewards, plans } = planInviteeRewards({
      redemptionId: redemption.id,
      inviteeId,
      isRewardClaimed,
    });
    if (plans.length > 0) {
      await this.#addPendingGrants(plans, now);
      const pendingCount = await this.#applyInviteePremiumNow(redemption.id, inviteeId, now);
      // 바로 적용하지 않은 지급이 남으면 원장과 같은 트랜잭션에 작업을 넣어 커밋되면 반드시 처리된다
      if (pendingCount > 0) {
        await rewardScheduler.schedule(redemption.id, { kind: "redeemed" });
      }
    }
    return { redemptionId: redemption.id, rewards };
  }

  async #addPendingGrants(plans: readonly RewardGrantPlan[], now: Temporal.Instant): Promise<void> {
    await this.#dependencies.rewardGrantRepository.addPending(
      plans.map((plan) => RewardGrant.create({ id: RewardGrantId.generate(), plan, now })),
    );
  }

  // 수락 화면이 "프리미엄 7일을 받았어요"를 바로 보여 주므로 초대받은 사람 프리미엄은 같은 트랜잭션에서 적용한다.
  // 친구 한도 잠금 뒤에 사용자 행을 잠가 웹훅·sweep·지급 작업과 순서가 엇갈리지 않고, 같은 출처 키라 한 번만 반영된다.
  // 바로 적용하지 않고 남긴 지급 수를 돌려준다
  async #applyInviteePremiumNow(
    redemptionId: InviteRedemptionId,
    inviteeId: UserId,
    now: Temporal.Instant,
  ): Promise<number> {
    const { rewardGrantRepository, rewardApplier } = this.#dependencies;
    const grants = await rewardGrantRepository.listByRedemptionId(redemptionId);
    let pendingCount = 0;
    for (const grant of grants) {
      if (!grant.isFor(inviteeId) || grant.rewardType !== REWARD_TYPE.PREMIUM_DAYS) {
        if (!grant.isApplied()) {
          pendingCount += 1;
        }
        continue;
      }
      if (!(await rewardGrantRepository.markApplied(grant.id, now))) {
        continue;
      }
      await rewardApplier.apply(grant);
    }
    return pendingCount;
  }
}
