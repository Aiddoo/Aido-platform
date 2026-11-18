import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationInboxReaderPort } from "../../application/ports/notification-inbox.reader.port.js";
import type { UnreadNotificationCountReaderPort } from "../../application/ports/unread-notification-count.reader.port.js";
import { NotificationCacheKey } from "../cache/notification-cache.keyspace.js";

// 알림함 조회가 채운 안 읽은 수 캐시("all" 범위)를 먼저 읽고 없는 사람만 한 쿼리로 센다.
// 묶음 발송이 수신자마다 키를 새로 쓰면 공용 LRU를 밀어내므로 캐시에는 쓰지 않는다
@Injectable()
export class CachedUnreadNotificationCountReaderAdapter implements UnreadNotificationCountReaderPort {
  readonly #cacheService: CacheStorePort;
  readonly #inboxReader: Pick<NotificationInboxReaderPort, "countUnreadByUsers">;

  constructor(cacheService: CacheStorePort, inboxReader: NotificationInboxReaderPort) {
    this.#cacheService = cacheService;
    this.#inboxReader = inboxReader;
  }

  async countByUsers(users: readonly UserId[]): Promise<ReadonlyMap<string, number>> {
    if (users.length === 0) {
      return new Map();
    }
    const cached = await this.#cacheService.mget(
      users.map((user) => NotificationCacheKey.unreadCount(user.value)),
      z.number(),
    );
    const counts = new Map<string, number>();
    const missedUsers: UserId[] = [];
    for (const [index, user] of users.entries()) {
      const count = cached[index];
      if (count == null) {
        missedUsers.push(user);
      } else if (count > 0) {
        counts.set(user.value, count);
      }
    }
    if (missedUsers.length === 0) {
      return counts;
    }
    for (const [userId, count] of await this.#inboxReader.countUnreadByUsers(missedUsers)) {
      counts.set(userId, count);
    }
    return counts;
  }
}
