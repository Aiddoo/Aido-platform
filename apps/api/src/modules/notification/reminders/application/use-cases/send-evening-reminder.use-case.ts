import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";

import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { plainDateToDate } from "#api/shared/domain/time/plain-date";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import { createEveningReminderNotificationMessage } from "../../../push/application/messages/scheduler-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { resolveRecipientLocale } from "../../../push/domain/recipient-locale.domain-service.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { type ScheduledReminderReaderPort } from "../ports/scheduled-reminder-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import type { UserWithTodosAndStreak } from "../read-models/scheduler.read-model.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

interface EveningReminderStrategyDependencies {
  readonly reader: Pick<
    ScheduledReminderReaderPort,
    "findFreeEveningReminderUsers" | "findPremiumEveningReminderUsers"
  >;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendEveningReminderUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: EveningReminderStrategyDependencies;

  constructor(dependencies: EveningReminderStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{
    sent: number;
    recipientUserIds: string[];
  }> {
    const { tz, localHour, localMinute, userId, today, tomorrow } = ctx;

    // 프리미엄 사용자: 커스텀 시간에 리마인더 발송
    const premiumUsers = await this.#dependencies.reader.findPremiumEveningReminderUsers({
      tz,
      hour: localHour,
      minute: localMinute,
      today,
      tomorrow,
      userId: userId == null ? undefined : UserId.reconstitute(userId),
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
        lastCompletedDate: toStreakDate(user.preference?.lastCompletedDate),
        todosCompleted: completed,
        todosTotal: total,
        today: plainDateToDate(today),
      });

      const message = createEveningReminderNotificationMessage({
        completed,
        total,
        streak,
        isStreakAtRisk,
        locale: resolveRecipientLocale({
          storedLocale: user.preference?.locale ?? null,
          lastRequestLocale: null,
        }),
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.EVENING_REMINDER,
          recipientId: user.id,
          occurrenceKey: today.toString(),
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
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
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

// identity의 스트릭 판정은 아직 UTC 자정 Date로 계산한다
function toStreakDate(date: Temporal.PlainDate | null | undefined): Date | null {
  return date == null ? null : plainDateToDate(date);
}
