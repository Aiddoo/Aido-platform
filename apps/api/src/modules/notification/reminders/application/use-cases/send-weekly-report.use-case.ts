import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import { createWeeklyReportNotificationMessage } from "../../../push/application/messages/notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { type ScheduledReminderReaderPort } from "../ports/scheduled-reminder-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

interface WeeklyReportStrategyDependencies {
  readonly reader: Pick<ScheduledReminderReaderPort, "findWeeklyReportRecipients">;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendWeeklyReportUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: WeeklyReportStrategyDependencies;

  constructor(dependencies: WeeklyReportStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz, today } = ctx;
    const weekAgo = today.subtract({ days: 7 });

    // 오케스트레이터가 월요일 09:00에만 호출 → 프리미엄 유저 대상
    const users = await this.#dependencies.reader.findWeeklyReportRecipients({
      tz,
      periodStart: weekAgo,
      periodEnd: today,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => u.id),
        type: "WEEKLY_REPORT",
        notificationDate: today,
      });

    const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    const locales = await this.#dependencies.preferenceReader.findUserLocales(
      filteredUsers.map((u) => u.id),
    );
    const notifications = filteredUsers.map((user) => {
      const message = createWeeklyReportNotificationMessage({
        locale: locales.get(user.id) ?? DEFAULT_LOCALE,
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.WEEKLY_REPORT,
          recipientId: user.id,
          occurrenceKey: today.toString(),
        },
      });
      return {
        userId: user.id,
        type: "WEEKLY_REPORT" as const,
        purpose: "SCHEDULED_SERVICE" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.WEEKLY_REPORT,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    this.#dependencies.logger.log({
      event: NotificationRemindersLogEvent.WEEKLY_REPORT_SENT,
      timezone: tz,
      count: notifications.length,
    });
    return { sent: notifications.length };
  }
}
