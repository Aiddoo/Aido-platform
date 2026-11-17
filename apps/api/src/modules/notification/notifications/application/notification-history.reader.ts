import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationLogEvent } from "./notifications.log-events.js";
import { type NotificationDeduplicationPort } from "./ports/notification-deduplication.port.js";
import {
  type FindAlreadyNotifiedUserIdsQuery,
  type FindNudgeSuggestedFriendsQuery,
  type FindWinbackStagesSinceQuery,
  type NotificationHistoryReaderPort,
} from "./ports/notification-history.reader.port.js";

/**
 * 이미 알림을 받은 사용자 ID 목록 조회 유스케이스 (배치)
 *
 * Sentinel 기반 atomic cold-start 감지:
 * - 단일 SMISMEMBER 호출로 sentinel + userIds를 동시에 확인
 * - Sentinel 있음 = warm → Redis 결과 신뢰
 * - Sentinel 없음 = cold start → DB fallback + warm-up
 */
interface NotificationHistoryReaderDependencies {
  readonly notificationDeduplication: Pick<
    NotificationDeduplicationPort,
    "readKnownRecipients" | "warmRecipients"
  >;
  readonly notificationHistoryReader: Pick<
    NotificationHistoryReaderPort,
    "findAlreadyNotifiedUserIds" | "findNudgeSuggestedFriends" | "findWinbackStagesSince"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

export class NotificationHistoryReader {
  readonly #dependencies: NotificationHistoryReaderDependencies;

  constructor(dependencies: NotificationHistoryReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async findAlreadyNotifiedUserIds(params: FindAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    const knownRecipients = await this.#dependencies.notificationDeduplication.readKnownRecipients(
      params.type,
      params.notificationDate,
      params.userIds,
    );
    if (knownRecipients != null) {
      return knownRecipients;
    }

    // Cold start: DB fallback + Redis warm-up
    const fromDb =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds(params);

    this.#dependencies.notificationDeduplication
      .warmRecipients(
        params.type,
        params.notificationDate,
        [...fromDb].map((userId) => UserId.reconstitute(userId)),
      )
      .catch(() => {
        this.#dependencies.logger.warn({
          event: NotificationLogEvent.NOTIFICATION_HISTORY_WARM_UP_FAILED,
          errorType: "cache-warm-up",
        });
      });

    return fromDb;
  }

  // 단계·주마다 한 번인 재방문 알림은 배포로 비는 메모리가 아니라 알림 행으로 판단한다
  findWinbackStagesSince(
    query: FindWinbackStagesSinceQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    return this.#dependencies.notificationHistoryReader.findWinbackStagesSince(query);
  }

  findNudgeSuggestedFriends(
    query: FindNudgeSuggestedFriendsQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    return this.#dependencies.notificationHistoryReader.findNudgeSuggestedFriends(query);
  }
}
