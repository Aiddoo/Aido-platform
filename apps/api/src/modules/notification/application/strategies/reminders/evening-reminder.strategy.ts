import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";

import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { toSupportedLocale } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { createEveningReminderNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationRemindersLogEvent } from "../../observability/reminders/notification-reminders-log.events.js";
import { type ScheduledReminderReaderPort } from "../../ports/reminders/scheduled-reminder-reader.port.js";
import type { UserWithTodosAndStreak } from "../../ports/reminders/scheduler-read-models.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationHistoryReader } from "../../readers/delivery/notification-history.reader.js";
import type { TimezoneReminderStrategy } from "./timezone-reminder.strategy.js";

interface EveningReminderStrategyDependencies {
  readonly reader: Pick<
    ScheduledReminderReaderPort,
    "findFreeEveningReminderUsers" | "findPremiumEveningReminderUsers"
  >;
  readonly notificationPublisher: Pick<NotificationPublisher, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class EveningReminderStrategy implements TimezoneReminderStrategy {
  readonly #dependencies: EveningReminderStrategyDependencies;

  constructor(dependencies: EveningReminderStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{
    sent: number;
    recipientUserIds: string[];
  }> {
    const { tz, localHour, localMinute, userId } = ctx;
    const today = todayInTimezone(tz);
    const tomorrow = addDays(1, today);

    // 프리미엄 사용자: 커스텀 시간에 리마인더 발송
    const premiumUsers = await this.#dependencies.reader.findPremiumEveningReminderUsers({
      tz,
      hour: localHour,
      minute: localMinute,
      today,
      tomorrow,
      userId,
    });

    // 무료 사용자: 고정 시간(19:00)에만 발송
    const defaultHour = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR;
    const defaultMinute = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE;
    const isFreeReminderTime = localHour === defaultHour && localMinute === defaultMinute;

    let freeUsers: UserWithTodosAndStreak[] = [];
    if (!userId && isFreeReminderTime) {
      freeUsers = await this.#dependencies.reader.findFreeEveningReminderUsers({
        tz,
        today,
        tomorrow,
      });
    }

    const users = [...premiumUsers, ...freeUsers];

    if (users.length === 0) {
      return { sent: 0, recipientUserIds: [] };
    }

    // 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => u.id),
        type: "EVENING_REMINDER",
        notificationDate: today,
      });

    const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0, recipientUserIds: [] };
    }

    const notifications = filteredUsers.map((user) => {
      const total = user.todos.length;
      const completed = user.todos.filter((t) => t.completed).length;

      // 스트릭 정보 계산 (StreakService 순수 함수에 위임)
      const { streak, isAtRisk: isStreakAtRisk } = computeEffectiveStreak({
        currentStreak: user.preference?.currentStreak ?? 0,
        lastCompletedDate: user.preference?.lastCompletedDate ?? null,
        todosCompleted: completed,
        todosTotal: total,
        today,
      });

      const message = createEveningReminderNotificationMessage({
        completed,
        total,
        streak,
        isStreakAtRisk,
        locale: toSupportedLocale(user.preference?.locale),
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
          recipientId: user.id,
          occurrenceKey: toDateString(today),
        },
      });

      return {
        userId: user.id,
        type: "EVENING_REMINDER" as const,
        purpose: "SCHEDULED_SERVICE" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    this.#dependencies.logger.log({
      event: NotificationRemindersLogEvent.EVENING_REMINDER_SENT,
      timezone: tz,
      localHour,
      localMinute,
      count: notifications.length,
    });
    return {
      sent: notifications.length,
      recipientUserIds: notifications.map((notification) => notification.userId),
    };
  }
}
