import { vi } from "vitest";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import { NotificationCacheKey } from "../cache/notification-cache.keyspace.js";
import { CachedUnreadNotificationCountReaderAdapter } from "./cached-unread-notification-count-reader.adapter.js";

describe("CachedUnreadNotificationCountReaderAdapter", () => {
  it("알림함이 캐시한 수를 먼저 쓰고 없는 사람만 한 번에 세며 캐시에는 쓰지 않는다", async () => {
    // Given
    const cache = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    const notifications = new InMemoryNotificationRepository();
    await notifications.createNotification(createNotificationDraftFixture({ userId: "loaded" }));
    await notifications.createNotification(createNotificationDraftFixture({ userId: "loaded" }));
    await notifications.createNotification(createNotificationDraftFixture({ userId: "cached" }));
    await cache.set(NotificationCacheKey.unreadCount("cached"), 5);
    await cache.set(NotificationCacheKey.unreadCount("cleared"), 0);
    const countUnreadByUsers = vi.spyOn(notifications, "countUnreadByUsers");
    const reader = new CachedUnreadNotificationCountReaderAdapter(cache, notifications);

    // When
    const counts = await reader.countByUsers(
      ["cached", "cleared", "loaded", "nobody"].map((userId) => UserId.reconstitute(userId)),
    );

    // Then
    expect([...counts]).toEqual([
      ["cached", 5],
      ["loaded", 2],
    ]);
    expect(countUnreadByUsers).toHaveBeenCalledExactlyOnceWith([
      UserId.reconstitute("loaded"),
      UserId.reconstitute("nobody"),
    ]);
    await expect(cache.has(NotificationCacheKey.unreadCount("loaded"))).resolves.toBe(false);
  });
});
