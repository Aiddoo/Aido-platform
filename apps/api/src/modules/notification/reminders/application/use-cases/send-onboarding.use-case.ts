import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { createOnboardingNotificationMessage } from "../../../push/application/messages/system-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import {
  isOnboardingDay,
  ONBOARDING_MAX_DAY,
  requiresCompletedCount,
  resolveOnboardingDeepLinkPath,
} from "../../domain/onboarding.domain-service.js";
import { elapsedDaysUntil, utcStartOf } from "../../domain/reminder-day.domain-service.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

interface OnboardingStrategyDependencies {
  readonly reader: Pick<
    ReEngagementReaderPort,
    "countCompletedTodosByUsers" | "findOnboardingCandidates"
  >;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendOnboardingUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: OnboardingStrategyDependencies;

  constructor(dependencies: OnboardingStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz, today } = ctx;
    const cutoffDate = utcStartOf(today.subtract({ days: ONBOARDING_MAX_DAY }));

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
      const day = elapsedDaysUntil(today, user.createdAt);
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
          occurrenceKey: today.toString(),
        },
      };
      const message = requiresCompletedCount(day)
        ? createOnboardingNotificationMessage({ day, completedCount, ...notificationContext })
        : createOnboardingNotificationMessage({ day, ...notificationContext });

      notifications.push({
        userId: user.id,
        type: "SYSTEM_NOTICE",
        // 사용법 안내라 서비스 알림이다. 광고성 동의·참여 유도 한도를 적용하지 않으니 문구에 프로모션을 넣지 않는다
        purpose: "SCHEDULED_SERVICE",
        campaignKey: SCHEDULER_CAMPAIGN_KEY.ONBOARDING,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        action: { type: "DEEP_LINK", url: resolveOnboardingDeepLinkPath(day, completedCount) },
        notificationDate: today,
        metadata: { onboardingDay: day },
      });
    }

    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.publishBatch(notifications);
      this.#dependencies.logger.log({
        event: NotificationRemindersLogEvent.ONBOARDING_SENT,
        timezone: tz,
        count: notifications.length,
      });
    }

    return { sent: notifications.length };
  }
}
