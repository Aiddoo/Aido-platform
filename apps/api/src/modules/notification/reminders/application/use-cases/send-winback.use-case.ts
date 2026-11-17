import type { SupportedLocale } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReader,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { createWinbackNotificationMessage } from "../../../shared/application/messages/system-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import { localDayRangeAcross, localDaysSince } from "../../domain/reminder-day.domain-service.js";
import {
  resolveWinbackStage,
  type WinbackStageName,
} from "../../domain/winback-stage.constants.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import type { WinbackUserReadModel } from "../read-models/scheduler.read-model.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

interface WinbackStrategyDependencies {
  readonly reader: Pick<ReEngagementReaderPort, "findWinbackUsers">;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "getUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReader,
    "findAlreadyNotifiedUserIds" | "findWinbackStagesSince"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 현지 달력으로 이만큼 활동하지 않은 사용자에게 보낸다
const WINBACK_INACTIVE_DAYS = { MIN: 3, MAX: 30 } as const;

export class SendWinbackUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: WinbackStrategyDependencies;

  constructor(dependencies: WinbackStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(timezoneContext: TimezoneContext): Promise<{ sent: number }> {
    const { timezones, today } = timezoneContext;
    // 현지 달력으로 3~30일 전 날에 마지막으로 활동했다. 넓게 읽고 사람마다 날 수로 거른다
    const range = localDayRangeAcross(
      timezones,
      today.subtract({ days: WINBACK_INACTIVE_DAYS.MAX }),
      today.subtract({ days: WINBACK_INACTIVE_DAYS.MIN - 1 }),
    );
    if (range == null) {
      return { sent: 0 };
    }

    // 3~30일 미접속 유저
    const users = await this.#dependencies.reader.findWinbackUsers({
      timezones,
      inactiveSince: range.since,
      inactiveUntil: range.until,
    });

    if (users.length === 0) {
      return { sent: 0 };
    }

    // 오늘 WINBACK 중복 방지
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: users.map((u) => UserId.reconstitute(u.id)),
        type: "WINBACK",
        notificationDate: today,
      });

    const filteredUsers = users.filter((u) => !alreadyNotified.has(u.id));

    if (filteredUsers.length === 0) {
      return { sent: 0 };
    }

    const checks = toWinbackChecks(filteredUsers, today);
    // 단계는 쉬는 동안 한 번씩이다. 마지막 활동 뒤 받은 단계를 한 번에 읽는다
    const sentStages = await this.#dependencies.notificationHistoryReader.findWinbackStagesSince({
      recipients: checks.map(({ userId, lastActiveAt }) => ({
        userId: UserId.reconstitute(userId),
        since: lastActiveAt,
      })),
    });
    const activeChecks = checks.filter(
      ({ userId, stage }) => sentStages.get(userId)?.has(stage) !== true,
    );
    const localeOf = await this.#dependencies.preferenceReader.getUserLocales(
      activeChecks.map((check) => UserId.reconstitute(check.userId)),
    );

    const notifications = activeChecks.map((check) =>
      toWinbackNotification(check, localeOf(check.userId), today),
    );

    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.execute(notifications);

      this.#dependencies.logger.log({
        event: ReminderLogEvent.WINBACK_SENT,
        timezones,
        count: notifications.length,
      });
    }
    return { sent: notifications.length };
  }
}

interface WinbackCheck {
  readonly userId: string;
  readonly stage: WinbackStageName;
  readonly inactiveDays: number;
  readonly lastActiveAt: Temporal.Instant;
}

function toWinbackChecks(
  users: readonly WinbackUserReadModel[],
  today: Temporal.PlainDate,
): WinbackCheck[] {
  return users.flatMap(({ id, lastActiveAt, timezone }) => {
    if (lastActiveAt == null) {
      return [];
    }
    const inactiveDays = localDaysSince(lastActiveAt, today, timezone);
    if (inactiveDays < WINBACK_INACTIVE_DAYS.MIN || inactiveDays > WINBACK_INACTIVE_DAYS.MAX) {
      return [];
    }
    return [{ userId: id, stage: resolveWinbackStage(inactiveDays), inactiveDays, lastActiveAt }];
  });
}

function toWinbackNotification(
  check: WinbackCheck,
  locale: SupportedLocale,
  today: Temporal.PlainDate,
): CreateNotificationData {
  const message = createWinbackNotificationMessage({
    inactiveDays: check.inactiveDays,
    locale,
    variantContext: {
      campaignKey: `${SCHEDULER_CAMPAIGN_KEY.WINBACK}.${check.stage}`,
      recipientId: check.userId,
      occurrenceKey: today.toString(),
    },
  });
  return {
    userId: check.userId,
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
  };
}
