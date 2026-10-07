import type {
  CreateNotificationData,
  NotificationHistoryReader,
  NotificationPublisher,
} from "#api/modules/notification/notification-delivery.public";
import { createSocialDigestNotificationMessage } from "#api/modules/notification/notification-delivery.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import { SCHEDULER_CAMPAIGN_KEY } from "../../../domain/services/reminders/notification-campaign.js";
import type {
  ITimezoneStrategy,
  TimezoneContext,
} from "../../../domain/services/reminders/timezone-context.js";
import { type ReEngagementReaderPort } from "../../ports/reminders/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../../ports/reminders/scheduler-preference-reader.port.js";

interface SocialDigestStrategyDependencies {
  readonly reader: ReEngagementReaderPort;
  readonly preferenceReader: SchedulerPreferenceReaderPort;
  readonly notificationPublisher: NotificationPublisher;
  readonly notificationHistoryReader: NotificationHistoryReader;
  readonly logger: ApplicationLogger;
}

export class SocialDigestStrategy implements ITimezoneStrategy {
  readonly #dependencies: SocialDigestStrategyDependencies;

  constructor(dependencies: SocialDigestStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    ctx: TimezoneContext,
    recipientUserIds: readonly string[] = [],
  ): Promise<{ sent: number }> {
    if (recipientUserIds.length === 0) {
      return { sent: 0 };
    }
    const { tz } = ctx;
    const today = todayInTimezone(tz);
    const tomorrow = addDays(1, today);

    // 해당 타임존 + 오늘 투두 미완료인 유저 조회
    const users = await this.#dependencies.reader.findSocialDigestCandidates({
      tz,
      today,
      tomorrow,
      recipientUserIds,
    });

    // 전체 완료한 유저 제외
    const incompleteUsers = users.filter((u) => u.todos.some((t) => !t.completed));

    if (incompleteUsers.length === 0) {
      return { sent: 0 };
    }

    // 중복 방지
    const [alreadyNotified, streakAtRiskNotified] = await Promise.all([
      this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: incompleteUsers.map((u) => u.id),
        type: "SOCIAL_DIGEST",
        notificationDate: today,
      }),
      this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: incompleteUsers.map((u) => u.id),
        type: "STREAK_AT_RISK",
        notificationDate: today,
      }),
    ]);

    const candidates = incompleteUsers.filter(
      (u) => !alreadyNotified.has(u.id) && !streakAtRiskNotified.has(u.id),
    );

    if (candidates.length === 0) {
      return { sent: 0 };
    }

    const candidateIds = candidates.map((u) => u.id);

    // 배치 1: 모든 candidate의 맞팔 관계를 한 번에 조회
    const allFollows = await this.#dependencies.reader.findAcceptedFollows(candidateIds);

    // per-user 친구 ID 맵
    const friendIdMap = new Map<string, Set<string>>();
    const allFriendIds = new Set<string>();
    for (const f of allFollows) {
      for (const uid of candidateIds) {
        if (f.followerId === uid || f.followingId === uid) {
          const friendId = f.followerId === uid ? f.followingId : f.followerId;
          if (!friendIdMap.has(uid)) friendIdMap.set(uid, new Set());
          friendIdMap.get(uid)?.add(friendId);
          allFriendIds.add(friendId);
        }
      }
    }

    if (allFriendIds.size === 0) {
      return { sent: 0 };
    }

    // 배치 2: 모든 친구의 오늘 투두 완료 현황을 한 번에 조회
    const friendsWithTodos = await this.#dependencies.reader.findFriendsWithTodayTodos({
      friendIds: [...allFriendIds],
      today,
      tomorrow,
    });

    // 전체 완료한 친구만 필터링 (이름 미설정은 수신자 로케일별 폴백으로 치환)
    const completedFriendMap = new Map<string, { name: string | null }>();
    for (const f of friendsWithTodos) {
      if (f.todos.length > 0 && f.todos.every((t) => t.completed)) {
        completedFriendMap.set(f.id, {
          name: f.profile?.name ?? null,
        });
      }
    }

    const locales = await this.#dependencies.preferenceReader.findUserLocales(
      candidates.map((u) => u.id),
    );

    // 인메모리 매칭
    const notifications: CreateNotificationData[] = [];

    for (const user of candidates) {
      const userFriendIds = friendIdMap.get(user.id);

      if (!userFriendIds || userFriendIds.size === 0) {
        continue;
      }

      const completedFriends = [...userFriendIds]
        .map((id) => completedFriendMap.get(id))
        .filter((f): f is { name: string | null } => f !== undefined);

      if (completedFriends.length === 0) {
        continue;
      }

      const locale = locales.get(user.id) ?? DEFAULT_LOCALE;
      const fallbackName = locale === "en" ? "Your friend" : "친구";
      const variantContext = {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.SOCIAL_DIGEST,
        recipientId: user.id,
        occurrenceKey: toDateString(today),
      };
      const message =
        completedFriends.length === 1
          ? createSocialDigestNotificationMessage({
              kind: "single",
              friendName: completedFriends[0]?.name ?? fallbackName,
              locale,
              variantContext,
            })
          : createSocialDigestNotificationMessage({
              kind: "multiple",
              completedFriendCount: completedFriends.length,
              locale,
              variantContext,
            });

      notifications.push({
        userId: user.id,
        type: "SOCIAL_DIGEST",
        purpose: "ENGAGEMENT",
        campaignKey: SCHEDULER_CAMPAIGN_KEY.SOCIAL_DIGEST,
        variantId: message.variantId,
        title: message.title,
        body: message.body,
        notificationDate: today,
      });
    }

    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.publishBatch(notifications);
      this.#dependencies.logger.log(`Social digest: tz=${tz}, count=${notifications.length}`);
    }
    return { sent: notifications.length };
  }
}
