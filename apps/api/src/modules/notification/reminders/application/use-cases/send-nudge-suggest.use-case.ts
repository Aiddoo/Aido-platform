import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReader,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { createNudgeSuggestionNotificationMessage } from "../../../shared/application/messages/scheduler-notification.messages.js";
import { getNotificationFriendFallback } from "../../../shared/application/messages/social-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import {
  isoWeekRangeOf,
  localDayRangeAcross,
  localDaysSince,
} from "../../domain/reminder-day.domain-service.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

interface NudgeSuggestStrategyDependencies {
  readonly reader: Pick<
    ReEngagementReaderPort,
    "findActiveUsersInTimezones" | "findNudgeSuggestFollows"
  >;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReader,
    "findAlreadyNotifiedUserIds" | "findNudgeSuggestedFriends"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

// 받는 사람 현지 달력으로 이만큼 쉰 맞팔 친구를 찔러보라고 제안한다
const FRIEND_INACTIVE_DAYS = { MIN: 3, MAX: 7 } as const;

export class SendNudgeSuggestUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: NudgeSuggestStrategyDependencies;

  constructor(dependencies: NudgeSuggestStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(timezoneContext: TimezoneContext): Promise<{ sent: number }> {
    const { timezones, today } = timezoneContext;
    // 친구가 현지 달력으로 3~7일 쉬었다. 묶음 전체를 넓게 읽고 받는 사람 달력으로 거른다
    const range = localDayRangeAcross(
      timezones,
      today.subtract({ days: FRIEND_INACTIVE_DAYS.MAX }),
      today.subtract({ days: FRIEND_INACTIVE_DAYS.MIN - 1 }),
    );
    if (range == null) {
      return { sent: 0 };
    }

    // 이 타임존의 활성 유저 목록
    const activeUsers = await this.#dependencies.reader.findActiveUsersInTimezones(timezones);

    if (activeUsers.length === 0) {
      return { sent: 0 };
    }

    // 이미 오늘 NUDGE_SUGGEST 받은 유저 제외
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: activeUsers.map((u) => UserId.reconstitute(u.id)),
        type: "NUDGE_SUGGEST",
        notificationDate: today,
      });

    const candidates = activeUsers.filter((u) => !alreadyNotified.has(u.id));

    if (candidates.length === 0) {
      return { sent: 0 };
    }

    const candidateIds = candidates.map((u) => u.id);
    const candidateSet = new Set(candidateIds);

    // 배치 1: 모든 candidate의 비활성 맞팔 친구를 한 번에 조회
    const allFollows = await this.#dependencies.reader.findNudgeSuggestFollows({
      candidateIds,
      activeSince: range.since,
      activeUntil: range.until,
    });

    // per-user 친구 맵 생성
    const friendMap = new Map<
      string,
      Array<{ id: string; name: string | null; lastActiveAt: Temporal.Instant | null }>
    >();
    for (const f of allFollows) {
      const userIds = [f.followerId, f.followingId].filter((id) => candidateSet.has(id));
      for (const uid of userIds) {
        const friend = f.followerId === uid ? f.following : f.follower;
        if (!friendMap.has(uid)) {
          friendMap.set(uid, []);
        }
        friendMap.get(uid)?.push({
          id: friend.id,
          name: friend.profile?.name ?? null,
          lastActiveAt: friend.lastActiveAt,
        });
      }
    }

    // 배치 2: 이번 ISO 주에 이미 제안한 (받는 사람, 친구) 쌍을 한 번에 읽는다
    const week = isoWeekRangeOf(today);
    const suggestedFriends =
      await this.#dependencies.notificationHistoryReader.findNudgeSuggestedFriends({
        userIds: candidates.map((user) => UserId.reconstitute(user.id)),
        start: week.start,
        end: week.end,
      });

    const localeOf = await this.#dependencies.preferenceReader.findUserLocales(
      candidates.map((u) => u.id),
    );

    // 인메모리 매칭
    const notifications: CreateNotificationData[] = [];

    for (const user of candidates) {
      const alreadySuggested = suggestedFriends.get(user.id);
      const eligibleFriends = (friendMap.get(user.id) ?? [])
        .filter((friend) => alreadySuggested?.has(friend.id) !== true)
        .flatMap((friend) => {
          if (friend.lastActiveAt == null) {
            return [];
          }
          const days = localDaysSince(friend.lastActiveAt, today, user.timezone);
          return FRIEND_INACTIVE_DAYS.MIN <= days && days <= FRIEND_INACTIVE_DAYS.MAX
            ? [{ ...friend, days }]
            : [];
        })
        .sort((a, b) => b.days - a.days);

      const target = eligibleFriends[0];

      if (target == null || target.lastActiveAt == null) {
        continue;
      }

      const locale = localeOf(user.id);
      const message = createNudgeSuggestionNotificationMessage({
        friendName: target.name ?? getNotificationFriendFallback(locale),
        locale,
        variantContext: {
          campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
          recipientId: user.id,
          occurrenceKey: today.toString(),
        },
      });

      notifications.push({
        userId: user.id,
        type: "NUDGE_SUGGEST",
        purpose: "ENGAGEMENT",
        campaignKey: SCHEDULER_CAMPAIGN_KEY.NUDGE_SUGGEST,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        friendId: target.id,
        notificationDate: today,
      });
    }

    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.execute(notifications);

      this.#dependencies.logger.log({
        event: ReminderLogEvent.NUDGE_SUGGEST_SENT,
        timezones,
        count: notifications.length,
      });
    }
    return { sent: notifications.length };
  }
}
