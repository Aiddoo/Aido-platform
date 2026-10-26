import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import {
  hasOneActiveDayLeft,
  nextQualifyReminderAt,
  qualifyReminderExpiresBefore,
} from "../../../domain/policies/invites/invite-qualify-reminder.policy.js";
import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type {
  InviteQualifyReminderSchedulerPort,
  ScheduledQualifyReminder,
} from "../../ports/invites/invite-qualify-reminder.scheduler.port.js";
import type {
  InviteRedemptionRepositoryPort,
  QualifyReminderCandidate,
} from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";

export const QUALIFY_REMINDER_SCHEDULING = {
  BATCH_SIZE: 500,
  // 정비 작업의 다른 단계와 같은 상한으로 한 실행을 job 만료 안에 끝내고 남은 후보는 다음 날 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
} as const;

export interface ScheduleInviteQualifyRemindersInput {
  readonly now: Date;
}

export interface ScheduleInviteQualifyRemindersResult {
  readonly scheduledCount: number;
}

interface ScheduleInviteQualifyRemindersDependencies {
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findQualifyReminderCandidates"
  >;
  readonly reminderScheduler: InviteQualifyReminderSchedulerPort;
  readonly inviteConfig: InviteConfigPort;
  readonly logger: ApplicationLogger;
}

/**
 * 하루 한 번 정비 작업에서 마감이 다가온 수락을 골라 초대받은 사람 시간대의 저녁에 보낼 작업을 만든다.
 * 정비 작업은 새벽(KST)에 돌아 바로 보내면 야간이라 걸러진다. 실제 자격·발송 표시는 보낼 때 다시 확인한다.
 */
export class ScheduleInviteQualifyReminders {
  readonly #dependencies: ScheduleInviteQualifyRemindersDependencies;

  constructor(dependencies: ScheduleInviteQualifyRemindersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: ScheduleInviteQualifyRemindersInput,
  ): Promise<ScheduleInviteQualifyRemindersResult> {
    if (!this.#dependencies.inviteConfig.isEnabled) return { scheduledCount: 0 };

    let after: QualifyReminderCandidate | undefined;
    let scheduledCount = 0;
    for (let batch = 0; batch < QUALIFY_REMINDER_SCHEDULING.MAX_BATCHES_PER_RUN; batch++) {
      const candidates =
        await this.#dependencies.inviteRedemptionRepository.findQualifyReminderCandidates({
          now: input.now,
          expiresBefore: qualifyReminderExpiresBefore(input.now),
          ...(after != null && {
            after: { expiresAt: after.expiresAt, redemptionId: after.redemptionId },
          }),
          limit: QUALIFY_REMINDER_SCHEDULING.BATCH_SIZE,
        });
      const reminders = candidates.flatMap((candidate) => toReminder(candidate, input.now));
      await this.#dependencies.reminderScheduler.scheduleMany(reminders);
      scheduledCount += reminders.length;

      if (candidates.length < QUALIFY_REMINDER_SCHEDULING.BATCH_SIZE) break;
      after = candidates.at(-1);
    }

    this.#dependencies.logger.log({
      event: SocialInviteLogEvent.QUALIFY_REMINDERS_SCHEDULED,
      scheduledCount,
    });
    return { scheduledCount };
  }
}

function toReminder(candidate: QualifyReminderCandidate, now: Date): ScheduledQualifyReminder[] {
  if (!hasOneActiveDayLeft(candidate.activeDayCount)) return [];
  const sendAt = nextQualifyReminderAt(now, candidate.timezone);
  // 보낼 시각에 이미 마감됐다면 "하루만 더"가 맞지 않는다
  if (sendAt.getTime() >= candidate.expiresAt.getTime()) return [];
  return [{ redemptionId: candidate.redemptionId, sendAt }];
}
