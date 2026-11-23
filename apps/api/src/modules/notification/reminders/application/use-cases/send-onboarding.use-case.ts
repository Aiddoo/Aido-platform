import type { SupportedLocale } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReaderPort,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { createOnboardingNotificationMessage } from "../../../shared/application/messages/system-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import {
  isOnboardingDay,
  type OnboardingDay,
  ONBOARDING_MAX_DAY,
  requiresCompletedCount,
  resolveOnboardingDeepLinkPath,
} from "../../domain/onboarding.domain-service.js";
import { localDayRangeAcross, localDaysSince } from "../../domain/reminder-day.domain-service.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

interface OnboardingStrategyDependencies {
  readonly reader: Pick<
    ReEngagementReaderPort,
    "countCompletedTodosByUsers" | "listOnboardingCandidates"
  >;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "getUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "listAlreadyNotifiedUserIds"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendOnboardingUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: OnboardingStrategyDependencies;

  constructor(dependencies: OnboardingStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(timezoneContext: TimezoneContext): Promise<{ sent: number }> {
    const { timezones, today } = timezoneContext;
    const range = localDayRangeAcross(
      timezones,
      today.subtract({ days: ONBOARDING_MAX_DAY }),
      today,
    );
    if (range == null) {
      return { sent: 0 };
    }

    // 가입 0~7일 + 해당 timezone 유저 조회
    const users = await this.#dependencies.reader.listOnboardingCandidates({
      timezones,
      createdSince: range.since,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    // 발송 대상 day에 해당하는 유저만 필터
    const eligibleUsers = users.flatMap((user) => {
      const day = localDaysSince(user.createdAt, today, user.timezone);
      return isOnboardingDay(day) ? [{ user, day }] : [];
    });

    if (eligibleUsers.length === 0) {
      return { sent: 0 };
    }

    // 오늘 SYSTEM_NOTICE 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.listAlreadyNotifiedUserIds({
        userIds: eligibleUsers.map(({ user }) => UserId.reconstitute(user.id)),
        type: "SYSTEM_NOTICE",
        notificationDate: today,
      });

    const filteredUsers = eligibleUsers.filter(({ user }) => !alreadyNotified.has(user.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    const completedCountMap = await this.#countCompletedTodos(filteredUsers);

    // 알림 데이터 생성
    const localeOf = await this.#dependencies.preferenceReader.getUserLocales(
      filteredUsers.map(({ user }) => UserId.reconstitute(user.id)),
    );
    const notifications = filteredUsers.map(({ user, day }) =>
      toOnboardingNotification({
        userId: user.id,
        day,
        completedCount: completedCountMap.get(user.id) ?? 0,
        locale: localeOf(user.id),
        today,
      }),
    );

    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.execute(notifications);
      this.#dependencies.logger.log({
        event: ReminderLogEvent.ONBOARDING_SENT,
        timezones,
        count: notifications.length,
      });
    }

    return { sent: notifications.length };
  }

  // Day 5, 7 유저는 completedCount 조회
  async #countCompletedTodos(
    users: readonly { readonly user: { readonly id: string }; readonly day: OnboardingDay }[],
  ): Promise<Map<string, number>> {
    const needsCountUserIds = users
      .filter(({ day }) => requiresCompletedCount(day))
      .map(({ user }) => user.id);

    const completedCountMap = new Map<string, number>();
    if (needsCountUserIds.length > 0) {
      const counts = await this.#dependencies.reader.countCompletedTodosByUsers(
        needsCountUserIds.map((userId) => UserId.reconstitute(userId)),
      );

      for (const row of counts) {
        completedCountMap.set(row.userId, row.count);
      }
    }
    return completedCountMap;
  }
}

function toOnboardingNotification({
  userId,
  day,
  completedCount,
  locale,
  today,
}: {
  readonly userId: string;
  readonly day: OnboardingDay;
  readonly completedCount: number;
  readonly locale: SupportedLocale;
  readonly today: Temporal.PlainDate;
}): CreateNotificationData {
  const notificationContext = {
    locale,
    variantContext: {
      campaignKey: `${SCHEDULER_CAMPAIGN_KEY.ONBOARDING}.day_${day}`,
      recipientId: userId,
      occurrenceKey: today.toString(),
    },
  };
  const message = requiresCompletedCount(day)
    ? createOnboardingNotificationMessage({ day, completedCount, ...notificationContext })
    : createOnboardingNotificationMessage({ day, ...notificationContext });

  return {
    userId,
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
  };
}
