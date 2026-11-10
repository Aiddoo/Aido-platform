import { groupBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { NotificationHistoryReader } from "../../../inbox/application/notification-history.reader.js";
import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { createSocialDigestNotificationMessage } from "../../../push/application/messages/notification.messages.js";
import { getNotificationFriendFallback } from "../../../push/application/messages/social-notification.messages.js";
import type { PublishNotificationUseCase } from "../../../push/application/use-cases/publish-notification.use-case.js";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/notification-campaign.constants.js";
import type { TimezoneContext } from "../../domain/timezone-context.read-model.js";
import { type ReEngagementReaderPort } from "../ports/re-engagement-reader.port.js";
import { type SchedulerPreferenceReaderPort } from "../ports/scheduler-preference-reader.port.js";
import type { TimezoneReminderStrategyPort } from "../ports/timezone-reminder-strategy.port.js";
import { NotificationRemindersLogEvent } from "../reminders.log-events.js";

interface SocialDigestStrategyDependencies {
  readonly reader: Pick<
    ReEngagementReaderPort,
    "findAcceptedFollows" | "findFriendsWithTodayTodos" | "findSocialDigestCandidates"
  >;
  readonly preferenceReader: Pick<SchedulerPreferenceReaderPort, "findUserLocales">;
  readonly notificationPublisher: Pick<PublishNotificationUseCase, "publishBatch">;
  readonly notificationHistoryReader: Pick<NotificationHistoryReader, "findAlreadyNotifiedUserIds">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendSocialDigestUseCase implements TimezoneReminderStrategyPort {
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
    const { tz, today, tomorrow } = ctx;

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

    const allFollows = await this.#dependencies.reader.findAcceptedFollows(candidateIds);

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
      friendIds: [...allFriendIds],
      today,
      tomorrow,
    });

    const completedFriendMap = new Map(
      friendsWithTodos
        .filter((friend) => friend.todos.length > 0 && friend.todos.every((t) => t.completed))
        .map((friend) => [friend.id, { name: friend.profile?.name ?? null }]),
    );

    const locales = await this.#dependencies.preferenceReader.findUserLocales(
      candidates.map((u) => u.id),
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

      const locale = locales.get(user.id) ?? DEFAULT_LOCALE;
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
      await this.#dependencies.notificationPublisher.publishBatch(notifications);
      this.#dependencies.logger.log({
        event: NotificationRemindersLogEvent.SOCIAL_DIGEST_SENT,
        timezone: tz,
        count: notifications.length,
      });
    }
    return { sent: notifications.length };
  }
}
