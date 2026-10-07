import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { createLunchNudgeNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationRemindersLogEvent } from "../../observability/reminders/notification-reminders-log.events.js";
import { type ScheduledReminderReaderPort } from "../../ports/reminders/scheduled-reminder-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationHistoryReader } from "../../readers/delivery/notification-history.reader.js";
import type { TimezoneReminderStrategy } from "./timezone-reminder.strategy.js";

/**
 * 점심 넛지 Strategy (12:30)
 *
 * 오늘 할일이 있지만 완료가 0개인 유저에게 점심 넛지를 발송합니다.
 * 고정 시간(12:30) 전용 — 프리미엄 커스텀 시간 미지원.
 */
interface LunchNudgeStrategyDependencies {
  readonly reader: Pick<ScheduledReminderReaderPort, "findLunchNudgeUsers">;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<NotificationPublisher, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class LunchNudgeStrategy implements TimezoneReminderStrategy {
  readonly #dependencies: LunchNudgeStrategyDependencies;

  constructor(dependencies: LunchNudgeStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz } = ctx;
    const today = todayInTimezone(tz);
    const tomorrow = addDays(1, today);

    // 오늘 할일이 있지만 완료가 0개인 유저 조회
    const users = await this.#dependencies.reader.findLunchNudgeUsers({
      tz,
      today,
      tomorrow,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    // 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => u.id),
        type: "LUNCH_NUDGE",
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
      const message = createLunchNudgeNotificationMessage({
        locale: locales.get(user.id) ?? DEFAULT_LOCALE,
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
          recipientId: user.id,
          occurrenceKey: toDateString(today),
        },
      });
      return {
        userId: user.id,
        type: "LUNCH_NUDGE" as const,
        purpose: "ENGAGEMENT" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.LUNCH_NUDGE,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    this.#dependencies.logger.log({
      event: NotificationRemindersLogEvent.LUNCH_NUDGE_SENT,
      timezone: tz,
      count: notifications.length,
    });
    return { sent: notifications.length };
  }
}
