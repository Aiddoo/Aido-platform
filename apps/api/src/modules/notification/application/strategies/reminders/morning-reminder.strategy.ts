import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { toSupportedLocale } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import {
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
} from "../../../push/application/messages/notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { NotificationRemindersLogEvent } from "../../observability/reminders/notification-reminders-log.events.js";
import { type ScheduledReminderReaderPort } from "../../ports/reminders/scheduled-reminder-reader.port.js";
import type { ReminderCountUser } from "../../ports/reminders/scheduler-read-models.js";
import type { TimezoneReminderStrategy } from "./timezone-reminder.strategy.js";

interface MorningReminderStrategyDependencies {
  readonly reader: Pick<
    ScheduledReminderReaderPort,
    "findFreeMorningReminderUsers" | "findPremiumMorningReminderUsers"
  >;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class MorningReminderStrategy implements TimezoneReminderStrategy {
  readonly #dependencies: MorningReminderStrategyDependencies;

  constructor(dependencies: MorningReminderStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz, localHour, localMinute, userId } = ctx;
    const today = todayInTimezone(tz);
    const tomorrow = addDays(1, today);

    // 프리미엄 사용자: 커스텀 시간에 리마인더 발송
    const premiumUsers = await this.#dependencies.reader.findPremiumMorningReminderUsers({
      tz,
      hour: localHour,
      minute: localMinute,
      today,
      tomorrow,
      userId,
    });

    // 무료 사용자: 고정 시간(08:00)에만 리마인더 발송 (catch-up 핸들러에서는 스킵)
    const defaultHour = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR;
    const defaultMinute = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE;
    const isFreeReminderTime = localHour === defaultHour && localMinute === defaultMinute;

    let freeUsers: ReminderCountUser[] = [];
    if (!userId && isFreeReminderTime) {
      freeUsers = await this.#dependencies.reader.findFreeMorningReminderUsers({
        tz,
        today,
        tomorrow,
      });
    }

    const users = [...premiumUsers, ...freeUsers];

    if (users.length === 0) {
      return { sent: 0 };
    }

    // 중복 방지: 이미 오늘 아침 리마인더를 받은 사용자 제외
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => u.id),
        type: "MORNING_REMINDER",
        notificationDate: today,
      });

    const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    const notifications = filteredUsers.map((user) => {
      const count = user._count.todos;
      const locale = toSupportedLocale(user.preference?.locale);
      const variantContext = {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.MORNING_REMINDER,
        recipientId: user.id,
        occurrenceKey: toDateString(today),
      };
      const message =
        count > 0
          ? createMorningReminderNotificationMessage({ count, locale, variantContext })
          : createMorningNoTodoNotificationMessage({ locale, variantContext });

      return {
        userId: user.id,
        type: "MORNING_REMINDER" as const,
        purpose: "SCHEDULED_SERVICE" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.MORNING_REMINDER,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    this.#dependencies.logger.log({
      event: NotificationRemindersLogEvent.MORNING_REMINDER_SENT,
      timezone: tz,
      localHour,
      localMinute,
      count: notifications.length,
    });
    return { sent: notifications.length };
  }
}
