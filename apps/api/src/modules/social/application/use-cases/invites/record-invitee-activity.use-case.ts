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
import { isFirstActiveDay } from "../../../domain/policies/invites/invite-qualify-reminder.policy.js";
import {
  InviteRewardPolicy,
  qualifiedRedemptionCount,
  rewardCapWindowStart,
} from "../../../domain/policies/invites/invite-reward.policy.js";
import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { InviteNotifierPort } from "../../ports/invites/invite-notifier.port.js";
import type { InviteRedemptionRepositoryPort } from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteRewardSchedulerPort } from "../../ports/invites/invite-reward.scheduler.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import type { RewardGrantRepositoryPort } from "../../ports/invites/reward-grant.repository.port.js";
import {
  isInvitePairReachable,
  type InvitePairReachabilityDependencies,
} from "../../services/invites/invite-pair-reachability.js";

export interface RecordInviteeActivityInput {
  readonly inviteeId: string;
  readonly occurredAt: Date;
}

export type RecordInviteeActivityResult =
  | { readonly status: "skipped" }
  | { readonly status: "recorded" }
  | { readonly status: "qualified"; readonly redemptionId: string; readonly grantCount: number };

/** 커밋 뒤 초대한 사람에게 첫 활동일을 알릴 수락 */
interface FirstActiveDay {
  readonly redemptionId: string;
  readonly inviterId: string;
}

type RecordedActivity =
  | { readonly status: "skipped" }
  | { readonly status: "recorded"; readonly firstActiveDay: FirstActiveDay | null }
  | { readonly status: "qualified"; readonly redemptionId: string; readonly grantCount: number };

interface RecordInviteeActivityDependencies extends InvitePairReachabilityDependencies {
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    | "hasJoinedByInviteeId"
    | "findByInviteeIdForUpdate"
    | "save"
    | "summarizeByInviterId"
    | "findDisplayName"
  >;
  readonly rewardGrantRepository: Pick<
    RewardGrantRepositoryPort,
    "summarizeInviterRewards" | "createPending"
  >;
  readonly rewardScheduler: InviteRewardSchedulerPort;
  readonly notifier: Pick<InviteNotifierPort, "notifyInviteProgress">;
  readonly inviteConfig: InviteConfigPort;
  readonly mutationLock: MutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/**
 * 초대받은 사람이 할 일을 마친 날짜를 모아 사용 시작을 판정하고 초대한 사람 보상을 남긴다.
 * 날짜는 수락할 때 고정한 시간대로만 센다. 요청마다 오는 시간대를 믿으면 시간대만 바꿔 같은 날
 * 두 번 셀 수 있다.
 */
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

    const result = await this.#dependencies.unitOfWork.run(async (): Promise<RecordedActivity> => {
      const redemption =
        await this.#dependencies.inviteRedemptionRepository.findByInviteeIdForUpdate(
          input.inviteeId,
        );
      if (
        redemption == null ||
        !redemption.recordActiveDay(
          localActivityDate(input.occurredAt, redemption.timezone),
          input.occurredAt,
        )
      ) {
        return { status: "skipped" } as const;
      }
      if (!InviteQualificationPolicy.isQualified(redemption) || redemption.inviterId == null) {
        await this.#dependencies.inviteRedemptionRepository.save(redemption);
        // 활동일 기록은 수락 행 잠금으로 직렬화되어 첫날로 바뀌는 실행은 한 번뿐이다. 배포 전에 이미
        // 첫날이 있던 수락은 여기서 다시 첫날이 되지 않으므로 지난 소식을 보내지 않는다
        const firstActiveDay =
          isFirstActiveDay(redemption) && redemption.inviterId != null
            ? { redemptionId: redemption.id, inviterId: redemption.inviterId }
            : null;
        return { status: "recorded", firstActiveDay };
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
      return result;
    }
    if (result.status === "recorded") {
      if (result.firstActiveDay != null) {
        await this.#notifyFirstActiveDay(input.inviteeId, result.firstActiveDay);
      }
      return { status: "recorded" };
    }
    return result;
  }

  /** 기록은 이미 커밋됐으므로 알림 실패는 할 일 흐름에 전파하지 않고 남긴다. */
  async #notifyFirstActiveDay(inviteeId: string, firstActiveDay: FirstActiveDay): Promise<void> {
    const { redemptionId, inviterId } = firstActiveDay;
    try {
      const skippedReason = await this.#progressSkipReason(inviteeId, inviterId);
      if (skippedReason != null) {
        this.#dependencies.logger.log({
          event: SocialInviteLogEvent.PROGRESS_NOTIFICATION_SKIPPED,
          redemptionId,
          reason: skippedReason,
        });
        return;
      }
      const inviteeName =
        await this.#dependencies.inviteRedemptionRepository.findDisplayName(inviteeId);
      if (inviteeName == null) return;
      await this.#dependencies.notifier.notifyInviteProgress({
        inviterId,
        inviteeName,
        redemptionId,
      });
      this.#dependencies.logger.log({
        event: SocialInviteLogEvent.PROGRESS_NOTIFIED,
        redemptionId,
      });
    } catch (error) {
      this.#dependencies.logger.warn({
        event: SocialInviteLogEvent.PROGRESS_NOTIFICATION_FAILED,
        redemptionId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  async #progressSkipReason(
    inviteeId: string,
    inviterId: string,
  ): Promise<"disabled" | "unreachable" | null> {
    // 꺼져 있는 동안은 INVITE_REWARDED처럼 초대 알림을 보내지 않는다
    if (!this.#dependencies.inviteConfig.isEnabled) return "disabled";
    if (!(await isInvitePairReachable(this.#dependencies, inviteeId, inviterId))) {
      return "unreachable";
    }
    return null;
  }

  async #qualify(
    redemption: InviteRedemption,
    inviterId: string,
    at: Date,
  ): Promise<RecordedActivity> {
    // 같은 초대한 사람의 상한을 여러 초대받은 사람이 동시에 읽지 않도록 잠근다
    await this.#dependencies.mutationLock.acquire([MutationLockKeys.inviteRewardLedger(inviterId)]);
    const [rewardTotals, summary] = await Promise.all([
      this.#dependencies.rewardGrantRepository.summarizeInviterRewards(
        inviterId,
        rewardCapWindowStart(at),
      ),
      this.#dependencies.inviteRedemptionRepository.summarizeByInviterId(inviterId),
    ]);

    // 상한에 닿아도 사용 시작은 인정하고 지급할 보상만 줄인다. 같은 기기·신원 재사용으로 초대받은
    // 사람 보상을 막은 수락은 초대한 사람 보상도 계획하지 않는다
    const plans = redemption.inviterRewardEligible
      ? InviteRewardPolicy.planInviterRewards(redemption, {
          inviterId,
          summary: InviteRewardPolicy.summarize(rewardTotals),
          priorQualifiedCount: qualifiedRedemptionCount(summary),
        })
      : [];

    redemption.qualify(at);
    await this.#dependencies.inviteRedemptionRepository.save(redemption);
    const grantCount = await this.#dependencies.rewardGrantRepository.createPending(plans);
    // 꺼져 있으면 원장만 PENDING으로 남긴다. 다시 켜면 정비 작업이 골라 적용하므로 보상을 잃지 않는다
    if (this.#dependencies.inviteConfig.isEnabled) {
      await this.#dependencies.rewardScheduler.schedule(redemption.id, { kind: "qualified" });
    }
    return { status: "qualified", redemptionId: redemption.id, grantCount };
  }
}
