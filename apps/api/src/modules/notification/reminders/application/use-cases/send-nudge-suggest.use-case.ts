import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { createNudgeSuggestionNotificationMessage } from "../../../push/application/messages/notification.messages.js";
import { getNotificationFriendFallback } from "../../../push/application/messages/social-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import {
  elapsedDaysUntil,
  isoWeekIdOf,
  utcStartOf,
} from "../../domain/reminder-day.domain-service.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerDedupPort } from "../ports/scheduler-dedup.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

interface NudgeSuggestStrategyDependencies {
  readonly reader: Pick<
    ReEngagementReaderPort,
    "findActiveUsersInTimezone" | "findNudgeSuggestFollows"
  >;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly schedulerDedup: Pick<SchedulerDedupPort, "findSentNudgePairs" | "recordNudgePairs">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendNudgeSuggestUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: NudgeSuggestStrategyDependencies;

  constructor(dependencies: NudgeSuggestStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(ctx: TimezoneContext): Promise<{ sent: number }> {
    const { tz, today } = ctx;
    const weekAgo = utcStartOf(today.subtract({ days: 7 }));
    const twoDaysAgo = utcStartOf(today.subtract({ days: 2 }));

    // 이 타임존의 활성 유저 목록
    const activeUsers = await this.#dependencies.reader.findActiveUsersInTimezone(tz);

    if (activeUsers.length === 0) {
      return { sent: 0 };
    }

    // 이미 오늘 NUDGE_SUGGEST 받은 유저 제외
    const alreadyNotified =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: activeUsers.map((u) => u.id),
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
      activeSince: weekAgo,
      activeUntil: twoDaysAgo,
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

    // 배치 2: 이번 주 발송 이력을 compound key로 단일 Redis 조회
    const weekId = isoWeekIdOf(today);
    // 전체 candidate × friend 조합을 한 번에 빌드
    const allPairs: string[] = [];
    for (const user of candidates) {
      const friends = friendMap.get(user.id) ?? [];
      const pairs = friends.map((f) => `${user.id}:${f.id}`);
      allPairs.push(...pairs);
    }

    // 단일 SMISMEMBER — O(allPairs.length)
    const sentPairs = await this.#dependencies.schedulerDedup.findSentNudgePairs(weekId, allPairs);

    const locales = await this.#dependencies.preferenceReader.findUserLocales(
      candidates.map((u) => u.id),
    );

    // 인메모리 매칭
    const notifications: CreateNotificationData[] = [];

    for (const user of candidates) {
      const friends = friendMap.get(user.id);

      if (friends == null || friends.length === 0) {
        continue;
      }

      const eligibleFriends = friends
        .filter((f) => !sentPairs.has(`${user.id}:${f.id}`))
        .sort((a, b) => {
          const daysA = a.lastActiveAt != null ? elapsedDaysUntil(today, a.lastActiveAt) : 0;
          const daysB = b.lastActiveAt != null ? elapsedDaysUntil(today, b.lastActiveAt) : 0;
          return daysB - daysA;
        });

      const target = eligibleFriends[0];

      if (target == null || target.lastActiveAt == null) {
        continue;
      }

      const locale = locales.get(user.id) ?? DEFAULT_LOCALE;
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

    // DB 성공 후 Redis 기록 (순서 보장)
    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.publishBatch(notifications);

      const members = notifications.map((n) => `${n.userId}:${n.friendId}`);
      void this.#dependencies.schedulerDedup.recordNudgePairs(weekId, members);

      this.#dependencies.logger.log({
        event: NotificationRemindersLogEvent.NUDGE_SUGGEST_SENT,
        timezone: tz,
        count: notifications.length,
      });
    }
    return { sent: notifications.length };
  }
}
