import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";
import { type NotificationDedupPort } from "../../ports/delivery/notification-dedup.port.js";
import { type NotificationHistoryReaderPort } from "../../ports/delivery/notification-history.reader.port.js";

/**
 * 이미 알림을 받은 사용자 ID 목록 조회 유스케이스 (배치)
 *
 * Sentinel 기반 atomic cold-start 감지:
 * - 단일 SMISMEMBER 호출로 sentinel + userIds를 동시에 확인
 * - Sentinel 있음 = warm → Redis 결과 신뢰
 * - Sentinel 없음 = cold start → DB fallback + warm-up
 */
interface FindAlreadyNotifiedUsersDependencies {
  readonly notificationDedup: NotificationDedupPort;
  readonly notificationHistoryReader: NotificationHistoryReaderPort;
  readonly logger: ApplicationLogger;
}

export class FindAlreadyNotifiedUsers {
  readonly #dependencies: FindAlreadyNotifiedUsersDependencies;

  constructor(dependencies: FindAlreadyNotifiedUsersDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(params: {
    userIds: string[];
    type: NotificationType;
    notificationDate: Date;
    friendId?: string;
  }): Promise<Set<string>> {
    const knownRecipients = await this.#dependencies.notificationDedup.readKnownRecipients(
      params.type,
      params.notificationDate,
      params.userIds,
    );
    if (knownRecipients) {
      return knownRecipients;
    }

    // Cold start: DB fallback + Redis warm-up
    const fromDb =
      await this.#dependencies.notificationHistoryReader.findAlreadyNotifiedUserIds(params);

    this.#dependencies.notificationDedup
      .warmRecipients(params.type, params.notificationDate, [...fromDb])
      .catch((error: unknown) => {
        this.#dependencies.logger.warn(`Failed to warm notification dedup recipients: ${error}`);
      });

    return fromDb;
  }
}
