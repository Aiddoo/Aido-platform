import type { InviteConfigPort } from "#api/modules/social/invites/social-invites.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviteRedemption } from "../../domain/invite-redemption.aggregate.js";
import {
  planInviterRewards,
  qualifiedRedemptionCount,
  rewardCapWindowStart,
  summarizeInviterRewards,
} from "../../domain/invite-reward.domain-service.js";
import { RewardGrantId } from "../../domain/reward-grant-id.vo.js";
import { RewardGrant } from "../../domain/reward-grant.entity.js";
import { InviteRedemptionLockKeys } from "../invite-redemptions.lock-keys.js";
import { InviteRedemptionLogEvent } from "../invite-redemptions.log-events.js";
import type { InviteNotifierPort } from "../ports/invite-notifier.port.js";
import type { InviteRedemptionReaderPort } from "../ports/invite-redemption.reader.port.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { InviteRewardSchedulerPort } from "../ports/invite-reward-scheduler.port.js";
import type { InviteUserReaderPort } from "../ports/invite-user.reader.port.js";
import type { RewardGrantRepositoryPort } from "../ports/reward-grant.repository.port.js";
import type { CheckInvitePairReachabilityUseCase } from "./check-invite-pair-reachability.use-case.js";

export interface RecordInviteeActivityCommand {
  readonly inviteeId: string;
  /** 할 일을 완료한 순간. 처리 시각이 아니라 이 순간으로 날짜를 정해 늦게 처리돼도 같은 활동일로 센다. */
  readonly occurredAt: Temporal.Instant;
}

export type RecordInviteeActivityResult =
  | { readonly status: "skipped" }
  | { readonly status: "recorded" }
  | { readonly status: "qualified"; readonly redemptionId: string; readonly grantCount: number };

/** 커밋 뒤 초대한 사람에게 첫 활동일을 알릴 수락 */
interface FirstActiveDay {
  readonly redemptionId: string;
  readonly inviterId: UserId;
}

type RecordedActivity =
  | { readonly status: "skipped" }
  | { readonly status: "recorded"; readonly firstActiveDay: FirstActiveDay | null }
  | { readonly status: "qualified"; readonly redemptionId: string; readonly grantCount: number };

export interface RecordInviteeActivityDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly mutationLock: MutationLockPort;
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "existsJoinedByInviteeId" | "findByInviteeIdForUpdate" | "save"
  >;
  readonly inviteRedemptionReader: Pick<
    InviteRedemptionReaderPort,
    "summarizeByInviterId" | "summarizeInviterRewards"
  >;
  readonly rewardGrantRepository: Pick<RewardGrantRepositoryPort, "addPending">;
  readonly userReader: Pick<InviteUserReaderPort, "findDisplayName">;
  readonly pairReachability: Pick<CheckInvitePairReachabilityUseCase, "execute">;
  readonly rewardScheduler: Pick<InviteRewardSchedulerPort, "schedule">;
  readonly notifier: Pick<InviteNotifierPort, "notifyInviteProgress">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/**
 * 초대받은 사람이 할 일을 마친 날짜를 모아 사용 시작을 판정하고 초대한 사람 보상을 남긴다.
 * 날짜는 수락할 때 고정한 시간대로만 센다. 요청마다 오는 시간대를 믿으면 시간대만 바꿔 같은 날
 * 두 번 셀 수 있다.
 */
export class RecordInviteeActivityUseCase {
  readonly #dependencies: RecordInviteeActivityDependencies;

  constructor(dependencies: RecordInviteeActivityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RecordInviteeActivityCommand): Promise<RecordInviteeActivityResult> {
    const { unitOfWork, inviteRedemptionRepository, logger } = this.#dependencies;
    const inviteeId = UserId.reconstitute(command.inviteeId);
    // 할 일 완료마다 불리므로 대부분은 UNIQUE 인덱스 한 번으로 끝난다
    if (!(await inviteRedemptionRepository.existsJoinedByInviteeId(inviteeId))) {
      return { status: "skipped" };
    }

    const result = await unitOfWork.run(async (): Promise<RecordedActivity> => {
      const redemption = await inviteRedemptionRepository.findByInviteeIdForUpdate(inviteeId);
      if (redemption == null || !redemption.recordActivity(command.occurredAt)) {
        return { status: "skipped" };
      }
      const { inviterId } = redemption;
      if (!redemption.hasEnoughActiveDays() || inviterId == null) {
        await inviteRedemptionRepository.save(redemption);
        // 활동일 기록은 수락 행 잠금으로 직렬화되어 첫날로 바뀌는 실행은 한 번뿐이다. 배포 전에 이미
        // 첫날이 있던 수락은 여기서 다시 첫날이 되지 않으므로 지난 소식을 보내지 않는다
        const firstActiveDay =
          redemption.isOnFirstActiveDay() && inviterId != null
            ? { redemptionId: redemption.id.value, inviterId }
            : null;
        return { status: "recorded", firstActiveDay };
      }

      return this.#qualify(redemption, inviterId, command.occurredAt);
    });

    if (result.status === "qualified") {
      logger.log({
        event: InviteRedemptionLogEvent.QUALIFIED,
        redemptionId: result.redemptionId,
        inviteeId: inviteeId.value,
        grantCount: result.grantCount,
      });
      return result;
    }
    if (result.status === "recorded") {
      if (result.firstActiveDay != null) {
        await this.#notifyFirstActiveDay(inviteeId, result.firstActiveDay);
      }
      return { status: "recorded" };
    }
    return result;
  }

  /** 기록은 이미 커밋됐으므로 알림 실패는 할 일 흐름에 전파하지 않고 남긴다. */
  async #notifyFirstActiveDay(inviteeId: UserId, firstActiveDay: FirstActiveDay): Promise<void> {
    const { userReader, notifier, logger } = this.#dependencies;
    const { redemptionId, inviterId } = firstActiveDay;
    try {
      const skippedReason = await this.#progressSkipReason(inviteeId, inviterId);
      if (skippedReason != null) {
        logger.log({
          event: InviteRedemptionLogEvent.PROGRESS_NOTIFICATION_SKIPPED,
          redemptionId,
          reason: skippedReason,
        });
        return;
      }
      const inviteeName = await userReader.findDisplayName(inviteeId);
      if (inviteeName == null) {
        return;
      }
      await notifier.notifyInviteProgress({
        inviterId: inviterId.value,
        inviteeName,
        redemptionId,
      });
      logger.log({ event: InviteRedemptionLogEvent.PROGRESS_NOTIFIED, redemptionId });
    } catch (error) {
      logger.warn({
        event: InviteRedemptionLogEvent.PROGRESS_NOTIFICATION_FAILED,
        redemptionId,
        errorType: toErrorType(error),
      });
    }
  }

  async #progressSkipReason(
    inviteeId: UserId,
    inviterId: UserId,
  ): Promise<"disabled" | "unreachable" | null> {
    // 꺼져 있는 동안은 INVITE_REWARDED처럼 초대 알림을 보내지 않는다
    if (!this.#dependencies.inviteConfig.isEnabled) {
      return "disabled";
    }
    if (!(await this.#dependencies.pairReachability.execute({ inviteeId, inviterId }))) {
      return "unreachable";
    }
    return null;
  }

  async #qualify(
    redemption: InviteRedemption,
    inviterId: UserId,
    occurredAt: Temporal.Instant,
  ): Promise<RecordedActivity> {
    const {
      mutationLock,
      inviteRedemptionRepository,
      inviteRedemptionReader,
      rewardGrantRepository,
      rewardScheduler,
      inviteConfig,
      clock,
    } = this.#dependencies;
    // 같은 초대한 사람의 상한을 여러 초대받은 사람이 동시에 읽지 않도록 잠근다
    await mutationLock.acquire([InviteRedemptionLockKeys.rewardLedger(inviterId)]);
    const [rewardTotals, summary] = await Promise.all([
      inviteRedemptionReader.summarizeInviterRewards(inviterId, rewardCapWindowStart(occurredAt)),
      inviteRedemptionReader.summarizeByInviterId(inviterId),
    ]);

    // 상한에 닿아도 사용 시작은 인정하고 지급할 보상만 줄인다. 같은 기기·신원 재사용으로 초대받은
    // 사람 보상을 막은 수락은 초대한 사람 보상도 계획하지 않는다
    const plans = redemption.inviterRewardEligible
      ? planInviterRewards({
          redemptionId: redemption.id,
          inviterId,
          summary: summarizeInviterRewards(rewardTotals),
          priorQualifiedCount: qualifiedRedemptionCount(summary),
        })
      : [];

    redemption.qualify(occurredAt);
    await inviteRedemptionRepository.save(redemption);
    const now = clock.now();
    const grantCount = await rewardGrantRepository.addPending(
      plans.map((plan) => RewardGrant.create({ id: RewardGrantId.generate(), plan, now })),
    );
    // 꺼져 있으면 원장만 PENDING으로 남긴다. 다시 켜면 정비 작업이 골라 적용하므로 보상을 잃지 않는다
    if (inviteConfig.isEnabled) {
      await rewardScheduler.schedule(redemption.id, { kind: "qualified" });
    }
    return { status: "qualified", redemptionId: redemption.id.value, grantCount };
  }
}
