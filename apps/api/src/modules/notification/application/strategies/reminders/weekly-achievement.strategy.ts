import type { WeeklyAchievementWriterPort } from "#api/modules/insights/insights-weekly-achievements.public";
import type {
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import { createWeeklyAchievementNotificationMessage } from "#api/modules/notification/notification-delivery.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { previousIsoWeekRange } from "#api/shared/domain/date/utils/range";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type {
  ITimezoneStrategy,
  TimezoneContext,
} from "../../../domain/services/reminders/timezone-context.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import { type WeeklyAchievementStatsReaderPort } from "../../ports/reminders/weekly-achievement-stats-reader.port.js";

interface WeeklyAchievementStrategyDependencies {
  readonly reader: WeeklyAchievementStatsReaderPort;
  readonly preferenceReader: SchedulerPreferenceReaderPort;
  readonly notificationPublisher: NotificationPublisher;
  readonly notificationHistoryReader: NotificationHistoryReader;
  readonly weeklyAchievementWriter: WeeklyAchievementWriterPort;
  readonly logger: ApplicationLogger;
}

export class WeeklyAchievementStrategy implements ITimezoneStrategy {
  readonly #dependencies: WeeklyAchievementStrategyDependencies;

  constructor(dependencies: WeeklyAchievementStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz } = ctx;
    const today = todayInTimezone(tz);

    // 월요일 실행 → 이전 주(월~일) 집계
    const { start, end, isoYear, isoWeek } = previousIsoWeekRange(today);

    // ─── A. DB 집계 (모든 유저, pushEnabled 무관) ──────────────
    const [totalByUser, completedByUser] = await Promise.all([
      this.#dependencies.reader.groupTotalTodosByUser({
        tz,
        periodStart: start,
        periodEnd: end,
      }),
      this.#dependencies.reader.groupCompletedTodosByUser({
        tz,
        periodStart: start,
        periodEnd: end,
      }),
    ]);

    if (totalByUser.length === 0) {
      return { sent: 0 };
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

    // ─── B. 기록 저장 (모든 유저 — pushEnabled/dedup 무관) ─────
    await this.#dependencies.weeklyAchievementWriter.execute({ records });

    // ─── C. 알림 발송 (completed > 0 + dedup) ────
    const completedUserIds = records.filter((r) => r.completedTodos > 0).map((r) => r.userId);

    if (completedUserIds.length === 0) {
      return { sent: 0 };
    }
    const freeRecipientIds = await this.#dependencies.reader.findFreeRecipientIds(completedUserIds);
    const notifiableUserIds = completedUserIds.filter((userId) => freeRecipientIds.has(userId));
    if (notifiableUserIds.length === 0) return { sent: 0 };

    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: notifiableUserIds,
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

    const locales = await this.#dependencies.preferenceReader.findUserLocales(
      finalRecords.map((r) => r.userId),
    );
    const notifications = finalRecords.map((r) => {
      const message = createWeeklyAchievementNotificationMessage({
        completedCount: r.completedTodos,
        totalCount: r.totalTodos,
        locale: locales.get(r.userId) ?? DEFAULT_LOCALE,
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.WEEKLY_ACHIEVEMENT,
          recipientId: r.userId,
          occurrenceKey: toDateString(today),
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
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);

    this.#dependencies.logger.log(
      `Weekly achievement: tz=${tz}, records=${records.length}, sent=${notifications.length}`,
    );
    return { sent: notifications.length };
  }
}
