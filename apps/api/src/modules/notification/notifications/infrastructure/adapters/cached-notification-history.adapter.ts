import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationMilestone } from "../../../shared/domain/notification-milestone.constants.js";
import { NotificationLogEvent } from "../../application/notifications.log-events.js";
import type { NotificationDeduplicationPort } from "../../application/ports/notification-deduplication.port.js";
import type {
  ExistsRecentNotificationQuery,
  ListAlreadyNotifiedUserIdsQuery,
  ListNudgeSuggestedFriendsQuery,
  ListWinbackStagesSinceQuery,
  NotificationHistoryReaderPort,
} from "../../application/ports/notification-history.reader.port.js";

interface CachedNotificationHistoryAdapterDependencies {
  readonly notificationDeduplication: Pick<
    NotificationDeduplicationPort,
    "readKnownRecipients" | "warmRecipients"
  >;
  readonly databaseReader: NotificationHistoryReaderPort;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

// 이미 받은 사람은 중복 방지 캐시 센티넬이 있으면(warm) 캐시만 믿고, 없으면(cold start) DB로 읽고 캐시를 채운다
export class CachedNotificationHistoryAdapter implements NotificationHistoryReaderPort {
  readonly #dependencies: CachedNotificationHistoryAdapterDependencies;

  constructor(dependencies: CachedNotificationHistoryAdapterDependencies) {
    this.#dependencies = dependencies;
  }

  existsRecentNotification(query: ExistsRecentNotificationQuery): Promise<boolean> {
    return this.#dependencies.databaseReader.existsRecentNotification(query);
  }

  async listAlreadyNotifiedUserIds(params: ListAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    const knownRecipients = await this.#dependencies.notificationDeduplication.readKnownRecipients(
      params.type,
      params.notificationDate,
      params.userIds,
    );
    if (knownRecipients != null) {
      return knownRecipients;
    }

    const fromDatabase = await this.#dependencies.databaseReader.listAlreadyNotifiedUserIds(params);
    this.#dependencies.notificationDeduplication
      .warmRecipients(
        params.type,
        params.notificationDate,
        [...fromDatabase].map((userId) => UserId.reconstitute(userId)),
      )
      .catch(() => {
        this.#dependencies.logger.warn({
          event: NotificationLogEvent.NOTIFICATION_HISTORY_WARM_UP_FAILED,
          errorType: "cache-warm-up",
        });
      });
    return fromDatabase;
  }

  // 단계·주마다 한 번인 재방문 알림은 배포로 비는 메모리가 아니라 알림 행으로 판단한다
  listWinbackStagesSince(
    query: ListWinbackStagesSinceQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    return this.#dependencies.databaseReader.listWinbackStagesSince(query);
  }

  listNudgeSuggestedFriends(
    query: ListNudgeSuggestedFriendsQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    return this.#dependencies.databaseReader.listNudgeSuggestedFriends(query);
  }

  hasMilestoneNotification(userId: UserId, milestone: NotificationMilestone): Promise<boolean> {
    return this.#dependencies.databaseReader.hasMilestoneNotification(userId, milestone);
  }
}
