import { Injectable } from "@nestjs/common";

import { DedupProviderPort } from "#api/platform/dedup/dedup-provider.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationType } from "../../../shared/domain/notification-type.constants.js";
import type {
  NotificationDeduplicationPort,
  NotificationDeduplicationEntry,
} from "../../application/ports/notification-deduplication.port.js";
import {
  NOTIFICATION_DEDUPLICATION_SENTINEL,
  NOTIFICATION_DEDUPLICATION_TTL_MS,
  notificationDeduplicationKey,
} from "../cache/notification-deduplication.keyspace.js";

@Injectable()
export class NotificationDeduplicationAdapter implements NotificationDeduplicationPort {
  readonly #dedupProvider: DedupProviderPort;

  constructor(dedupProvider: DedupProviderPort) {
    this.#dedupProvider = dedupProvider;
  }

  async recordNotifiedUsers(records: NotificationDeduplicationEntry[]): Promise<void> {
    const groups = new Map<string, string[]>();
    for (const record of records) {
      const key = notificationDeduplicationKey(record.type, record.notificationDate);
      const userIds = groups.get(key) ?? [];
      userIds.push(record.userId.value);
      groups.set(key, userIds);
    }

    await Promise.all(
      [...groups.entries()].map(([key, userIds]) =>
        this.#dedupProvider.addMembers(
          key,
          [NOTIFICATION_DEDUPLICATION_SENTINEL, ...userIds],
          NOTIFICATION_DEDUPLICATION_TTL_MS,
        ),
      ),
    );
  }

  async readKnownRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly UserId[],
  ): Promise<Set<string> | null> {
    const notifiedUsers = await this.#dedupProvider.filterMembers(
      notificationDeduplicationKey(type, notificationDate),
      [NOTIFICATION_DEDUPLICATION_SENTINEL, ...userIds.map((userId) => userId.value)],
    );
    if (!notifiedUsers.delete(NOTIFICATION_DEDUPLICATION_SENTINEL)) {
      return null;
    }
    return notifiedUsers;
  }

  warmRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly UserId[],
  ): Promise<void> {
    return this.#dedupProvider.addMembers(
      notificationDeduplicationKey(type, notificationDate),
      [NOTIFICATION_DEDUPLICATION_SENTINEL, ...userIds.map((userId) => userId.value)],
      NOTIFICATION_DEDUPLICATION_TTL_MS,
    );
  }
}
