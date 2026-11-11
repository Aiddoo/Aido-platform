import { Injectable } from "@nestjs/common";

import { DedupProviderPort } from "#api/platform/dedup/dedup-provider.port";

import type { NotificationType } from "../../../inbox/domain/notification-type.constants.js";
import type {
  NotificationDedupPort,
  NotificationDedupRecord,
} from "../../application/ports/notification-dedup.port.js";
import {
  NOTIFICATION_DEDUP_SENTINEL,
  NOTIFICATION_DEDUP_TTL_MS,
  notificationDedupKey,
} from "../cache/notification-dedup.keyspace.js";

@Injectable()
export class NotificationDedupAdapter implements NotificationDedupPort {
  readonly #dedupProvider: DedupProviderPort;

  constructor(dedupProvider: DedupProviderPort) {
    this.#dedupProvider = dedupProvider;
  }

  async recordNotifiedUsers(records: NotificationDedupRecord[]): Promise<void> {
    const groups = new Map<string, string[]>();
    for (const record of records) {
      const key = notificationDedupKey(record.type, record.notificationDate);
      const userIds = groups.get(key) ?? [];
      userIds.push(record.userId);
      groups.set(key, userIds);
    }

    await Promise.all(
      [...groups.entries()].map(([key, userIds]) =>
        this.#dedupProvider.addMembers(
          key,
          [NOTIFICATION_DEDUP_SENTINEL, ...userIds],
          NOTIFICATION_DEDUP_TTL_MS,
        ),
      ),
    );
  }

  async readKnownRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly string[],
  ): Promise<Set<string> | null> {
    const notifiedUsers = await this.#dedupProvider.filterMembers(
      notificationDedupKey(type, notificationDate),
      [NOTIFICATION_DEDUP_SENTINEL, ...userIds],
    );
    if (!notifiedUsers.delete(NOTIFICATION_DEDUP_SENTINEL)) {
      return null;
    }
    return notifiedUsers;
  }

  warmRecipients(
    type: NotificationType,
    notificationDate: Temporal.PlainDate,
    userIds: readonly string[],
  ): Promise<void> {
    return this.#dedupProvider.addMembers(
      notificationDedupKey(type, notificationDate),
      [NOTIFICATION_DEDUP_SENTINEL, ...userIds],
      NOTIFICATION_DEDUP_TTL_MS,
    );
  }
}
