import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import {
  hasOneActiveDayLeft,
  nextQualifyReminderAt,
  qualifyReminderExpiresBefore,
} from "../../domain/invite-qualify-reminder.domain-service.js";
import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { InviteLogEvent } from "../invites.log-events.js";
import type { InviteConfigPort } from "../ports/invite-config.port.js";
import type {
  InviteQualifyReminderSchedulerPort,
  ScheduledQualifyReminder,
} from "../ports/invite-qualify-reminder-scheduler.port.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { QualifyReminderCandidate } from "../read-models/qualify-reminder-candidate.read-model.js";

const QUALIFY_REMINDER_SCHEDULING = {
  BATCH_SIZE: 500,
  // 정비 작업의 다른 단계와 같은 상한으로 한 실행을 job 만료 안에 끝내고 남은 후보는 다음 날 이어 받는다
  MAX_BATCHES_PER_RUN: 20,
} as const;

export interface ScheduleInviteQualifyRemindersCommand {
  readonly now: Temporal.Instant;
}

export interface ScheduleInviteQualifyRemindersResult {
  readonly scheduledCount: number;
}

export interface ScheduleInviteQualifyRemindersDependencies {
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "listQualifyReminderCandidates"
  >;
  readonly reminderScheduler: Pick<InviteQualifyReminderSchedulerPort, "scheduleMany">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

function toReminder(
  candidate: QualifyReminderCandidate,
  now: Temporal.Instant,
): ScheduledQualifyReminder[] {
  if (!hasOneActiveDayLeft(candidate.activeDayCount)) {
    return [];
  }
  const sendAt = nextQualifyReminderAt({
    now,
    timeZone: TimeZone.reconstitute(candidate.timezone),
  });
  // 보낼 시각에 이미 마감됐다면 "하루만 더"가 맞지 않는다
  if (Temporal.Instant.compare(sendAt, candidate.expiresAt) >= 0) {
    return [];
  }
  return [{ redemptionId: InviteRedemptionId.reconstitute(candidate.redemptionId), sendAt }];
}

/**
 * 하루 한 번 정비 작업에서 마감이 다가온 수락을 골라 초대받은 사람 시간대의 저녁에 보낼 작업을 만든다.
 * 정비 작업은 새벽(KST)에 돌아 바로 보내면 야간이라 걸러진다. 실제 자격·발송 표시는 보낼 때 다시 확인한다.
 */
export class ScheduleInviteQualifyRemindersUseCase {
  readonly #dependencies: ScheduleInviteQualifyRemindersDependencies;

  constructor(dependencies: ScheduleInviteQualifyRemindersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: ScheduleInviteQualifyRemindersCommand,
  ): Promise<ScheduleInviteQualifyRemindersResult> {
    const { inviteRedemptionRepository, reminderScheduler, inviteConfig, logger } =
      this.#dependencies;
    if (!inviteConfig.isEnabled) {
      return { scheduledCount: 0 };
    }

    let after: QualifyReminderCandidate | null = null;
    let scheduledCount = 0;
    for (let batch = 0; batch < QUALIFY_REMINDER_SCHEDULING.MAX_BATCHES_PER_RUN; batch++) {
      const candidates = await inviteRedemptionRepository.listQualifyReminderCandidates({
        now: command.now,
        expiresBefore: qualifyReminderExpiresBefore(command.now),
        after,
        limit: QUALIFY_REMINDER_SCHEDULING.BATCH_SIZE,
      });
      const reminders = candidates.flatMap((candidate) => toReminder(candidate, command.now));
      await reminderScheduler.scheduleMany(reminders);
      scheduledCount += reminders.length;

      if (candidates.length < QUALIFY_REMINDER_SCHEDULING.BATCH_SIZE) {
        break;
      }
      after = candidates.at(-1) ?? null;
    }

    logger.log({ event: InviteLogEvent.QUALIFY_REMINDERS_SCHEDULED, scheduledCount });
    return { scheduledCount };
  }
}
