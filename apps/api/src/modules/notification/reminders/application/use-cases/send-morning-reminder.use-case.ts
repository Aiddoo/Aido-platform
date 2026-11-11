import { USER_PREFERENCE_DEFAULTS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import {
  createMorningNoTodoNotificationMessage,
  createMorningReminderNotificationMessage,
} from "../../../push/application/messages/scheduler-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { resolveRecipientLocale } from "../../../push/domain/recipient-locale.domain-service.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { type ScheduledReminderReaderPort } from "../ports/scheduled-reminder-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import type { ReminderCountUser } from "../read-models/scheduler.read-model.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

interface MorningReminderStrategyDependencies {
  readonly reader: Pick<
    ScheduledReminderReaderPort,
    "findFreeMorningReminderUsers" | "findPremiumMorningReminderUsers"
  >;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendMorningReminderUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: MorningReminderStrategyDependencies;

  constructor(dependencies: MorningReminderStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz, localHour, localMinute, userId, today, tomorrow } = ctx;

    // 프리미엄 사용자: 커스텀 시간에 리마인더 발송
    const premiumUsers = await this.#dependencies.reader.findPremiumMorningReminderUsers({
      tz,
      hour: localHour,
      minute: localMinute,
      today,
      tomorrow,
      userId: userId == null ? undefined : UserId.reconstitute(userId),
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
