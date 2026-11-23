import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";

import { computeEffectiveStreak } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReaderPort,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { createEveningReminderNotificationMessage } from "../../../shared/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import { resolveRecipientLocale } from "../../../shared/domain/recipient-locale.domain-service.js";
import {
  isReminderTimeDue,
  type TimezoneContext,
} from "../../domain/local-clock.domain-service.js";
import { type ScheduledReminderReaderPort } from "../ports/scheduled-reminder-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import type { EveningReminderUserReadModel } from "../read-models/scheduler.read-model.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

interface EveningReminderStrategyDependencies {
  readonly reader: Pick<
    ScheduledReminderReaderPort,
    "findFreeEveningReminderUsers" | "findPremiumEveningReminderUsers"
  >;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "findAlreadyNotifiedUserIds"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

interface EveningReminderRecipient {
  readonly userId: string;
  readonly timezone: string;
}

export class SendEveningReminderUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: EveningReminderStrategyDependencies;

  constructor(dependencies: EveningReminderStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(timezoneContext: TimezoneContext): Promise<{
    sent: number;
    recipients: EveningReminderRecipient[];
  }> {
    const { timezones, localHour, localMinute, reminderTimes, userId, today, tomorrow } =
      timezoneContext;

    // 프리미엄 사용자: 커스텀 시간에 리마인더 발송
    // 가을 DST로 두 번째 오는 시각처럼 울릴 시각이 없는 분은 조회하지 않는다
    const premiumUsers =
      reminderTimes.length === 0
        ? []
        : await this.#dependencies.reader.findPremiumEveningReminderUsers({
            timezones,
            times: reminderTimes,
            today,
            tomorrow,
            userId: userId == null ? undefined : UserId.reconstitute(userId),
          });

    // 무료 사용자: 고정 시간(19:00)에만 발송
    const defaultHour = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_HOUR;
    const defaultMinute = USER_PREFERENCE_DEFAULTS.EVENING_REMINDER_MINUTE;
    const isFreeReminderTime = isReminderTimeDue(timezoneContext, {
      hour: defaultHour,
      minute: defaultMinute,
    });

    let freeUsers: EveningReminderUserReadModel[] = [];
    if (!userId && isFreeReminderTime) {
      freeUsers = await this.#dependencies.reader.findFreeEveningReminderUsers({
        timezones,
        today,
        tomorrow,
      });
    }

    const users = [...premiumUsers, ...freeUsers];

    if (users.length === 0) {
      return { sent: 0, recipients: [] };
    }

    // 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => UserId.reconstitute(u.id)),
        type: "EVENING_REMINDER",
        notificationDate: today,
      });

    const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0, recipients: [] };
    }

    const notifications = filteredUsers.map((user) => toEveningReminderNotification(user, today));

    await this.#dependencies.notificationPublisher.execute(notifications);
    this.#dependencies.logger.log({
      event: ReminderLogEvent.EVENING_REMINDER_SENT,
      timezones,
      localHour,
      localMinute,
      count: notifications.length,
    });
    return {
      sent: notifications.length,
      recipients: filteredUsers.map(({ id, timezone }) => ({ userId: id, timezone })),
    };
  }
}

// identity의 스트릭 판정은 아직 UTC 자정 Date로 계산한다

function toEveningReminderNotification(
  user: EveningReminderUserReadModel,
  today: Temporal.PlainDate,
) {
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
}
