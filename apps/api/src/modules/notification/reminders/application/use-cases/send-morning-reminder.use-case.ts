import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReaderPort,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import {
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
} from "../../../shared/application/messages/scheduler-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import { resolveRecipientLocale } from "../../../shared/domain/recipient-locale.domain-service.js";
import {
  isReminderTimeDue,
  type TimezoneContext,
} from "../../domain/local-clock.domain-service.js";
import { type ScheduledReminderReaderPort } from "../ports/scheduled-reminder-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import type { ReminderCountUserReadModel } from "../read-models/scheduler.read-model.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

interface MorningReminderStrategyDependencies {
  readonly reader: Pick<
    ScheduledReminderReaderPort,
    "findFreeMorningReminderUsers" | "findPremiumMorningReminderUsers"
  >;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "findAlreadyNotifiedUserIds"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendMorningReminderUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: MorningReminderStrategyDependencies;

  constructor(dependencies: MorningReminderStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(timezoneContext: TimezoneContext): Promise<{ sent: number }> {
    const { timezones, localHour, localMinute, reminderTimes, userId, today, tomorrow } =
      timezoneContext;

    // 프리미엄 사용자: 커스텀 시간에 리마인더 발송
    // 가을 DST로 두 번째 오는 시각처럼 울릴 시각이 없는 분은 조회하지 않는다
    const premiumUsers =
      reminderTimes.length === 0
        ? []
        : await this.#dependencies.reader.findPremiumMorningReminderUsers({
            timezones,
            times: reminderTimes,
            today,
            tomorrow,
            userId: userId == null ? undefined : UserId.reconstitute(userId),
          });

    // 무료 사용자: 고정 시간(08:00)에만 리마인더 발송 (catch-up 핸들러에서는 스킵)
    const defaultHour = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_HOUR;
    const defaultMinute = USER_PREFERENCE_DEFAULTS.MORNING_REMINDER_MINUTE;
    const isFreeReminderTime = isReminderTimeDue(timezoneContext, {
      hour: defaultHour,
      minute: defaultMinute,
    });

    let freeUsers: ReminderCountUserReadModel[] = [];
    if (!userId && isFreeReminderTime) {
      freeUsers = await this.#dependencies.reader.findFreeMorningReminderUsers({
        timezones,
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
        userIds: users.map((u) => UserId.reconstitute(u.id)),
        type: "MORNING_REMINDER",
        notificationDate: today,
      });

    const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    const notifications = filteredUsers.map((user) => toMorningReminderNotification(user, today));

    await this.#dependencies.notificationPublisher.execute(notifications);
    this.#dependencies.logger.log({
      event: ReminderLogEvent.MORNING_REMINDER_SENT,
      timezones,
      localHour,
      localMinute,
      count: notifications.length,
    });
    return { sent: notifications.length };
  }
}

function toMorningReminderNotification(
  user: ReminderCountUserReadModel,
  today: Temporal.PlainDate,
) {
  const count = user._count.todos;
  const locale = resolveRecipientLocale({
    storedLocale: user.preference?.locale ?? null,
    lastRequestLocale: null,
  });
  const variantContext = {
    campaignKey: SCHEDULER_CAMPAIGN_KEY.MORNING_REMINDER,
    recipientId: user.id,
    occurrenceKey: today.toString(),
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
    copyKey: message.copyKey,
    copyFacts: message.copyFacts,
    notificationDate: today,
  };
}
