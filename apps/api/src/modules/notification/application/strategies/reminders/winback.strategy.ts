import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { diffInDays } from "#api/shared/domain/date/utils/compare";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type { TimezoneContext } from "../../../domain/services/reminders/timezone-context.js";
import { resolveWinbackStage } from "../../../domain/services/reminders/winback-stage.js";
import { createWinbackNotificationMessage } from "../../messages/delivery/notification-messages.js";
import { NotificationRemindersLogEvent } from "../../observability/reminders/notification-reminders-log.events.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import { type ReEngagementReaderPort } from "../../ports/reminders/re-engagement-reader.port.js";
import { type SchedulerDedupPort } from "../../ports/reminders/scheduler-dedup.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";
import type { NotificationPublisher } from "../../publishers/delivery/notification.publisher.js";
import type { NotificationHistoryReader } from "../../readers/delivery/notification-history.reader.js";
import type { TimezoneReminderStrategy } from "./timezone-reminder.strategy.js";

interface WinbackStrategyDependencies {
  readonly reader: Pick<ReEngagementReaderPort, "findWinbackUsers">;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<NotificationPublisher, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly schedulerDedup: Pick<SchedulerDedupPort, "hasWinbackStage" | "recordWinbackStages">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class WinbackStrategy implements TimezoneReminderStrategy {
  readonly #dependencies: WinbackStrategyDependencies;

  constructor(dependencies: WinbackStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz } = ctx;
    const today = todayInTimezone(tz);
    const cutoffStart = subtractDays(30, today);
    const cutoffEnd = subtractDays(3, today);

    // 3~30일 미접속 유저
    const users = await this.#dependencies.reader.findWinbackUsers({
      tz,
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
        if (user.lastActiveAt === null) return null;

        const inactiveDays = diffInDays(today, user.lastActiveAt);
        const stage = resolveWinbackStage(inactiveDays);
        const alreadySent = await this.#dependencies.schedulerDedup.hasWinbackStage(user.id, stage);
        return { user, stage, inactiveDays, alreadySent };
      }),
    );

    const activeChecks = checks.filter(
      (check): check is NonNullable<typeof check> =>
        check !== null && check !== undefined && !check.alreadySent,
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
          occurrenceKey: toDateString(today),
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
        timezone: tz,
        count: notifications.length,
      });
    }
    return { sent: notifications.length };
  }
}
