import { groupBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  NotificationHistoryReader,
  PublishNotificationBatchUseCase,
} from "../../../notifications/notification-notifications.public.js";
import { createSocialDigestNotificationMessage } from "../../../shared/application/messages/scheduler-notification.messages.js";
import { getNotificationFriendFallback } from "../../../shared/application/messages/social-notification.messages.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../../shared/domain/notification-campaign.constants.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import type { TimezoneContext } from "../../domain/local-clock.domain-service.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { ReminderLogEvent } from "../reminders.log-events.js";

interface SocialDigestStrategyDependencies {
  readonly reader: Pick<
    ReEngagementReaderPort,
    "findAcceptedFollows" | "findFriendsWithTodayTodos" | "findSocialDigestCandidates"
  >;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "getUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationBatchUseCase, "execute">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendSocialDigestUseCase implements TimezoneReminderStrategyPort {
  readonly #dependencies: SocialDigestStrategyDependencies;

  constructor(dependencies: SocialDigestStrategyDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    timezoneContext: TimezoneContext,
    recipientUserIds: readonly string[] = [],
  ): Promise<{ sent: number }> {
    if (recipientUserIds.length === 0) {
      return { sent: 0 };
    }
    const { timezones, today, tomorrow } = timezoneContext;

    // 해당 타임존 + 오늘 투두 미완료인 유저 조회
    const users = await this.#dependencies.reader.findSocialDigestCandidates({
      timezones,
      today,
      tomorrow,
      recipientUserIds: recipientUserIds.map((userId) => UserId.reconstitute(userId)),
    });

    // 전체 완료한 유저 제외
    const incompleteUsers = users.filter((u) => u.todos.some((t) => !t.completed));

    if (incompleteUsers.length === 0) {
      return { sent: 0 };
    }

    // 중복 방지
    const [alreadyNotified, streakAtRiskNotified] = await Promise.all([
      this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: incompleteUsers.map((u) => UserId.reconstitute(u.id)),
        type: "SOCIAL_DIGEST",
        notificationDate: today,
      }),
      this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds({
        userIds: incompleteUsers.map((u) => UserId.reconstitute(u.id)),
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

    const allFollows = await this.#dependencies.reader.findAcceptedFollows(
      candidateIds.map((candidateId) => UserId.reconstitute(candidateId)),
    );

    const candidateIdSet = new Set(candidateIds);
    const friendships = allFollows
      .flatMap((follow) => [
        { userId: follow.followerId, friendId: follow.followingId },
        { userId: follow.followingId, friendId: follow.followerId },
      ])
      .filter(({ userId }) => candidateIdSet.has(userId));
    const friendIdMap = new Map(
      Object.entries(groupBy(friendships, ({ userId }) => userId)).map(([userId, rows]) => [
        userId,
        new Set(rows.map(({ friendId }) => friendId)),
      ]),
    );
    const allFriendIds = new Set(friendships.map(({ friendId }) => friendId));

    if (allFriendIds.size === 0) {
      return { sent: 0 };
    }

    const friendsWithTodos = await this.#dependencies.reader.findFriendsWithTodayTodos({
      friendIds: [...allFriendIds].map((friendId) => UserId.reconstitute(friendId)),
      today,
      tomorrow,
    });

    const completedFriendMap = new Map(
      friendsWithTodos
        .filter((friend) => friend.todos.length > 0 && friend.todos.every((t) => t.completed))
        .map((friend) => [friend.id, { name: friend.profile?.name ?? null }]),
    );

    const localeOf = await this.#dependencies.preferenceReader.getUserLocales(
      candidates.map((u) => UserId.reconstitute(u.id)),
    );

    const notifications: CreateNotificationData[] = [];

    for (const user of candidates) {
      const userFriendIds = friendIdMap.get(user.id);

      if (userFriendIds == null || userFriendIds.size === 0) {
        continue;
      }

      const completedFriends = [...userFriendIds]
        .map((id) => completedFriendMap.get(id))
        .filter((f): f is { name: string | null } => f != null);

      if (completedFriends.length === 0) {
        continue;
      }

      const locale = localeOf(user.id);
      const fallbackName = getNotificationFriendFallback(locale);
      const variantContext = {
        campaignKey: SCHEDULER_CAMPAIGN_KEY.SOCIAL_DIGEST,
        recipientId: user.id,
        occurrenceKey: today.toString(),
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
        copyKey: message.copyKey,
        copyFacts: message.copyFacts,
        notificationDate: today,
      });
    }

    if (notifications.length > 0) {
      await this.#dependencies.notificationPublisher.execute(notifications);
      this.#dependencies.logger.log({
        event: ReminderLogEvent.SOCIAL_DIGEST_SENT,
        timezones,
        count: notifications.length,
      });
    }
    return { sent: notifications.length };
  }
}
