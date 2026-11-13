import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import { createLunchNudgeNotificationMessage } from "../../../push/application/messages/scheduler-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { type ScheduledReminderReaderPort } from "../ports/scheduled-reminder-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

/**
 * 점심 넛지 Strategy (12:30)
 *
 * 오늘 할일이 있지만 완료가 0개인 유저에게 점심 넛지를 발송합니다.
 * 고정 시간(12:30) 전용 — 프리미엄 커스텀 시간 미지원.
 */
interface LunchNudgeStrategyDependencies {
  readonly reader: Pick<ScheduledReminderReaderPort, "findLunchNudgeUsers">;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendLunchNudgeUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: LunchNudgeStrategyDependencies;

  constructor(dependencies: LunchNudgeStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { timezones, today, tomorrow } = ctx;

    // 오늘 할일이 있지만 완료가 0개인 유저 조회
    const users = await this.#dependencies.reader.findLunchNudgeUsers({
      timezones,
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
          occurrenceKey: today.toString(),
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
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    this.#dependencies.logger.log({
      event: NotificationRemindersLogEvent.LUNCH_NUDGE_SENT,
      timezones,
      count: notifications.length,
    });
    return { sent: notifications.length };
  }
}
