import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReaderPort,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { createWeeklyAchievementNotificationMessage } from "../../../shared/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import { previousIsoWeekOf } from "../../domain/reminder-day.domain-service.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { type WeeklyAchievementStatsReaderPort } from "../ports/weekly-achievement-stats-reader.port.js";
import type { WeeklyAchievementWriterPort } from "../ports/weekly-achievement-writer.port.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

interface WeeklyAchievementStrategyDependencies {
  readonly reader: Pick<
    WeeklyAchievementStatsReaderPort,
    "findFreeRecipientIds" | "groupCompletedTodosByUser" | "groupTotalTodosByUser"
  >;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "getUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "findAlreadyNotifiedUserIds"
  >;
  readonly weeklyAchievementWriter: Pick<WeeklyAchievementWriterPort, "execute">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendWeeklyAchievementUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: WeeklyAchievementStrategyDependencies;

  constructor(dependencies: WeeklyAchievementStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(timezoneContext: TimezoneContext): Promise<{ sent: number }> {
    const { timezones, today } = timezoneContext;

    const records = await this.#recordWeeklyAchievements(timezones, today);
    if (records.length === 0) {
      return { sent: 0 };
    }

    // C. 알림 발송 (completed > 0 + dedup)
    const completedUserIds = records.filter((r) => r.completedTodos > 0).map((r) => r.userId);

    if (completedUserIds.length === 0) {
      return { sent: 0 };
    }
    const freeRecipientIds = await this.#dependencies.reader.findFreeRecipientIds(
      completedUserIds.map((userId) => UserId.reconstitute(userId)),
    );
    const notifiableUserIds = completedUserIds.filter((userId) => freeRecipientIds.has(userId));
    if (notifiableUserIds.length === 0) {
      return { sent: 0 };
    }

    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: notifiableUserIds.map((userId) => UserId.reconstitute(userId)),
        type: "WEEKLY_ACHIEVEMENT",
        notificationDate: today,
      });

    const finalRecords = records.filter(
      (r) =>
        freeRecipientIds.has(r.userId) && r.completedTodos > 0 && !alreadyNotified.has(r.userId),
    );

    if (finalRecords.length === 0) {
      return { sent: 0 };
    }

    const localeOf = await this.#dependencies.preferenceReader.getUserLocales(
      finalRecords.map((r) => UserId.reconstitute(r.userId)),
    );
    const notifications = finalRecords.map((r) => {
      const message = createWeeklyAchievementNotificationMessage({
        completedCount: r.completedTodos,
        totalCount: r.totalTodos,
        locale: localeOf(r.userId),
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.WEEKLY_ACHIEVEMENT,
          recipientId: r.userId,
          occurrenceKey: today.toString(),
        },
      });
      return {
        userId: r.userId,
        type: "WEEKLY_ACHIEVEMENT" as const,
        purpose: "SCHEDULED_SERVICE" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.WEEKLY_ACHIEVEMENT,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.execute(notifications);

    this.#dependencies.logger.log({
      event: ReminderLogEvent.WEEKLY_ACHIEVEMENT_SENT,
      timezones,
      recordCount: records.length,
      count: notifications.length,
    });
    return { sent: notifications.length };
  }

  async #recordWeeklyAchievements(timezones: readonly string[], today: Temporal.PlainDate) {
    // 월요일 실행 → 이전 주(월~일) 집계
    const { start, end, isoYear, isoWeek } = previousIsoWeekOf(today);

    // A. DB 집계 (모든 유저, pushEnabled 무관)
    const [totalByUser, completedByUser] = await Promise.all([
      this.#dependencies.reader.groupTotalTodosByUser({
        timezones,
        periodStart: start,
        periodEnd: end,
      }),
      this.#dependencies.reader.groupCompletedTodosByUser({
        timezones,
        periodStart: start,
        periodEnd: end,
      }),
    ]);

    if (totalByUser.length === 0) {
      return [];
    }

    const completedMap = new Map(completedByUser.map((g) => [g.userId, g.count]));

    const records = totalByUser.map((g) => ({
      userId: g.userId,
      year: isoYear,
      week: isoWeek,
      totalTodos: g.count,
      completedTodos: completedMap.get(g.userId) ?? 0,
      achievedAt: today,
    }));

    // B. 기록 저장 (모든 유저 — pushEnabled/dedup 무관)
    await this.#dependencies.weeklyAchievementWriter.execute({
      records: records.map((record) => ({ ...record, userId: UserId.reconstitute(record.userId) })),
    });
    return records;
  }
}
