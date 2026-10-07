import type {
  CreateNotificationData,
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import { createOnboardingNotificationMessage } from "#api/modules/notification/notification-delivery.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { diffInDays } from "#api/shared/domain/date/utils/compare";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import {
  isOnboardingDay,
  ONBOARDING_MAX_DAY,
  requiresCompletedCount,
} from "../../../domain/services/reminders/onboarding.js";
import type {
  ITimezoneStrategy,
  TimezoneContext,
} from "../../../domain/services/reminders/timezone-context.js";
import { type ReEngagementReaderPort } from "../../ports/reminders/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";

interface OnboardingStrategyDependencies {
  readonly reader: ReEngagementReaderPort;
  readonly preferenceReader: SchedulerPreferenceReaderPort;
  readonly notificationPublisher: NotificationPublisher;
  readonly notificationHistoryReader: NotificationHistoryReader;
  readonly logger: ApplicationLogger;
}

export class OnboardingStrategy implements ITimezoneStrategy {
  readonly #dependencies: OnboardingStrategyDependencies;

  constructor(dependencies: OnboardingStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz } = ctx;
    const today = todayInTimezone(tz);
    const cutoffDate = subtractDays(ONBOARDING_MAX_DAY, today);

    // 가입 0~7일 + 해당 timezone 유저 조회
    const users = await this.#dependencies.reader.findOnboardingCandidates({
      tz,
      createdSince: cutoffDate,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    // 발송 대상 day에 해당하는 유저만 필터
    const eligibleUsers = users.flatMap((user) => {
      const day = diffInDays(today, user.createdAt);
      return isOnboardingDay(day) ? [{ user, day }] : [];
    });

    if (eligibleUsers.length === 0) {
      return { sent: 0 };
    }

    // 오늘 SYSTEM_NOTICE 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: eligibleUsers.map(({ user }) => user.id),
        type: "SYSTEM_NOTICE",
        notificationDate: today,
      });

    const filteredUsers = eligibleUsers.filter(({ user }) => !alreadyNotified.has(user.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    // Day 5, 7 유저는 completedCount 조회
    const needsCountUserIds = filteredUsers
      .filter(({ day }) => requiresCompletedCount(day))
      .map(({ user }) => user.id);

    const completedCountMap = new Map<string, number>();
    if (needsCountUserIds.length > 0) {
      const counts = await this.#dependencies.reader.countCompletedTodosByUsers(needsCountUserIds);

      for (const row of counts) {
        completedCountMap.set(row.userId, row.count);
      }
    }

    // 알림 데이터 생성
    const locales = await this.#dependencies.preferenceReader.findUserLocales(
      filteredUsers.map(({ user }) => user.id),
    );
    const notifications: CreateNotificationData[] = [];
    for (const { user, day } of filteredUsers) {
      const completedCount = completedCountMap.get(user.id) ?? 0;
      const notificationContext = {
        locale: locales.get(user.id) ?? DEFAULT_LOCALE,
        variantContext: {
          campaignKey: `${SCHEDULER_CAMPAIGN_KEY.ONBOARDING}.day_${day}`,
          recipientId: user.id,
          occurrenceKey: toDateString(today),
        },
      };
      const message = requiresCompletedCount(day)
        ? createOnboardingNotificationMessage({ day, completedCount, ...notificationContext })
        : createOnboardingNotificationMessage({ day, ...notificationContext });

      notifications.push({
        userId: user.id,
        type: "SYSTEM_NOTICE",
        purpose: "ENGAGEMENT",
        campaignKey: SCHEDULER_CAMPAIGN_KEY.ONBOARDING,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
        metadata: { onboardingDay: day },
      });
    }

    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.publishBatch(notifications);
      this.#dependencies.logger.log(`Onboarding: tz=${tz}, count=${notifications.length}`);
    }

    return { sent: notifications.length };
  }
}
