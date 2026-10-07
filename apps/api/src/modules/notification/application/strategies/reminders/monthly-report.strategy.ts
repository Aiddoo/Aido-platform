import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { subtractMonths } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { createMonthlyReportNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationRemindersLogEvent } from "../../observability/reminders/notification-reminders-log.events.js";
import { type ScheduledReminderReaderPort } from "../../ports/reminders/scheduled-reminder-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationHistoryReader } from "../../readers/delivery/notification-history.reader.js";
import type { TimezoneReminderStrategy } from "./timezone-reminder.strategy.js";

interface MonthlyReportStrategyDependencies {
  readonly reader: Pick<ScheduledReminderReaderPort, "findMonthlyReportRecipients">;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<NotificationPublisher, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class MonthlyReportStrategy implements TimezoneReminderStrategy {
  readonly #dependencies: MonthlyReportStrategyDependencies;

  constructor(dependencies: MonthlyReportStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz } = ctx;
    const today = todayInTimezone(tz);
    const monthAgo = subtractMonths(1, today);

    // 오케스트레이터가 매월 1일 10:00에만 호출 → 프리미엄 유저 대상
    const users = await this.#dependencies.reader.findMonthlyReportRecipients({
      tz,
      periodStart: monthAgo,
      periodEnd: today,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => u.id),
        type: "MONTHLY_REPORT",
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
      const message = createMonthlyReportNotificationMessage({
        locale: locales.get(user.id) ?? DEFAULT_LOCALE,
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.MONTHLY_REPORT,
          recipientId: user.id,
          occurrenceKey: toDateString(today),
        },
      });
      return {
        userId: user.id,
        type: "MONTHLY_REPORT" as const,
        purpose: "SCHEDULED_SERVICE" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.MONTHLY_REPORT,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    this.#dependencies.logger.log({
      event: NotificationRemindersLogEvent.MONTHLY_REPORT_SENT,
      timezone: tz,
      count: notifications.length,
    });
    return { sent: notifications.length };
  }
}
