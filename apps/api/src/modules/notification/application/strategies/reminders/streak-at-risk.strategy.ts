import { computeEffectiveStreak } from "#api/modules/identity/identity-settings.public";
import type {
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import { createStreakAtRiskNotificationMessage } from "#api/modules/notification/notification-delivery.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { toSupportedLocale } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type {
  ITimezoneStrategy,
  TimezoneContext,
} from "../../../domain/services/reminders/timezone-context.js";
import { type ReEngagementReaderPort } from "../../ports/reminders/re-engagement-reader.port.js";

/**
 * 스트릭 위기 Strategy (20:15)
 *
 * 스트릭 3일 이상인 유저 중 오늘 할일을 아직 다 완료하지 못한 유저에게
 * 스트릭 위기 알림을 발송합니다.
 * 고정 시간(20:15) 전용 — 야간(21:00) 시작 전 마지막 넛지.
 */
interface StreakAtRiskStrategyDependencies {
  readonly reader: ReEngagementReaderPort;
  readonly notificationPublisher: NotificationPublisher;
  readonly notificationHistoryReader: NotificationHistoryReader;
  readonly logger: ApplicationLogger;
}

export class StreakAtRiskStrategy implements ITimezoneStrategy {
  readonly #dependencies: StreakAtRiskStrategyDependencies;

  constructor(dependencies: StreakAtRiskStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz } = ctx;
    const today = todayInTimezone(tz);
    const tomorrow = addDays(1, today);

    // 스트릭 3일+ 유저 중 오늘 미완료 할일이 있는 유저 조회
    const users = await this.#dependencies.reader.findStreakAtRiskUsers({
      tz,
      today,
      tomorrow,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    // StreakService로 isAtRisk 재검증 + streak >= 3 필터
    // effective streak 값을 보존하여 알림 메시지에 사용
    const atRiskUsers = users
      .map((user) => {
        const total = user.todos.length;
        const completed = user.todos.filter((t) => t.completed).length;

        if (completed === total) return null;

        const { streak, isAtRisk } = computeEffectiveStreak({
          currentStreak: user.preference?.currentStreak ?? 0,
          lastCompletedDate: user.preference?.lastCompletedDate ?? null,
          todosCompleted: completed,
          todosTotal: total,
          today,
        });

        return isAtRisk && streak >= 3
          ? {
              id: user.id,
              effectiveStreak: streak,
              locale: toSupportedLocale(user.preference?.locale),
            }
          : null;
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    if (atRiskUsers.length === 0) {
      return { sent: 0 };
    }

    // 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: atRiskUsers.map((u) => u.id),
        type: "STREAK_AT_RISK",
        notificationDate: today,
      });

    const filteredUsers = atRiskUsers.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    const notifications = filteredUsers.map((user) => {
      const message = createStreakAtRiskNotificationMessage({
        streak: user.effectiveStreak,
        locale: user.locale,
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.STREAK_AT_RISK,
          recipientId: user.id,
          occurrenceKey: toDateString(today),
        },
      });
      return {
        userId: user.id,
        type: "STREAK_AT_RISK" as const,
        purpose: "ENGAGEMENT" as const,
        campaignKey: SCHEDULER_CAMPAIGN_KEY.STREAK_AT_RISK,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
      };
    });

    await this.#dependencies.notificationPublisher.publishBatch(notifications);
    this.#dependencies.logger.log(`Streak at risk: tz=${tz}, count=${notifications.length}`);
    return { sent: notifications.length };
  }
}
