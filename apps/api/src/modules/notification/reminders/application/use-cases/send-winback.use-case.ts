import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { createWinbackNotificationMessage } from "../../../push/application/messages/system-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import { elapsedDaysUntil, utcStartOf } from "../../domain/reminder-day.domain-service.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { resolveWinbackStage } from "../../domain/winback-stage.constants.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerDedupPort } from "../ports/scheduler-dedup.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

interface WinbackStrategyDependencies {
  readonly reader: Pick<ReEngagementReaderPort, "findWinbackUsers">;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly schedulerDedup: Pick<SchedulerDedupPort, "hasWinbackStage" | "recordWinbackStages">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendWinbackUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: WinbackStrategyDependencies;

  constructor(dependencies: WinbackStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { timezones, today } = ctx;
    const cutoffStart = utcStartOf(today.subtract({ days: 30 }));
    const cutoffEnd = utcStartOf(today.subtract({ days: 3 }));

    // 3~30일 미접속 유저
    const users = await this.#dependencies.reader.findWinbackUsers({
      timezones,
      inactiveSince: cutoffStart,
      inactiveUntil: cutoffEnd,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    // 오늘 WINBACK 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => u.id),
        type: "WINBACK",
        notificationDate: today,
      });

    const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    // 단계별 중복 방지: per-user Redis SISMEMBER 병렬 확인
    const checks = await Promise.all(
      filteredUsers.map(async (user) => {
        if (user.lastActiveAt == null) {
          return null;
        }

        const inactiveDays = elapsedDaysUntil(today, user.lastActiveAt);
        const stage = resolveWinbackStage(inactiveDays);
        const alreadySent = await this.#dependencies.schedulerDedup.hasWinbackStage(user.id, stage);
        return { user, stage, inactiveDays, alreadySent };
      }),
    );

    const activeChecks = checks.filter(
      (check): check is NonNullable<typeof check> => check != null && !check.alreadySent,
    );
    const locales = await this.#dependencies.preferenceReader.findUserLocales(
      activeChecks.map((check) => check.user.id),
    );

    const notifications: CreateNotificationData[] = [];
    for (const check of activeChecks) {
      const message = createWinbackNotificationMessage({
        inactiveDays: check.inactiveDays,
        locale: locales.get(check.user.id) ?? DEFAULT_LOCALE,
        variantContext: {
          campaignKey: `${SCHEDULER_CAMPAIGN_KEY.WINBACK}.${check.stage}`,
          recipientId: check.user.id,
          occurrenceKey: today.toString(),
        },
      });
      notifications.push({
        userId: check.user.id,
        type: "WINBACK",
        purpose: "ENGAGEMENT",
        campaignKey: SCHEDULER_CAMPAIGN_KEY.WINBACK,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        notificationDate: today,
        metadata: { stage: check.stage },
      });
    }

    // DB 성공 후 Redis 기록 (순서 보장)
    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.publishBatch(notifications);

      void this.#dependencies.schedulerDedup.recordWinbackStages(
        activeChecks.map((check) => ({
          userId: check.user.id,
          stage: check.stage,
        })),
      );

      this.#dependencies.logger.log({
        event: NotificationRemindersLogEvent.WINBACK_SENT,
        timezones,
        count: notifications.length,
      });
    }
    return { sent: notifications.length };
  }
}
