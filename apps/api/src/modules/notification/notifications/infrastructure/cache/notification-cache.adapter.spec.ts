import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NotificationCacheAdapter } from "./notification-cache.adapter.js";

describe("NotificationCacheAdapter — 미읽음 수 캐시", () => {
  it("미읽음 수를 세는 동안 알림 쓰기가 커밋해 무효화되면 센 값을 남기지 않는다", async () => {
    // Given
    const adapter = new NotificationCacheAdapter(
      new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
    );
    const userId = UserId.reconstitute("user-1");
    const countBeforeCommit = async () => {
      await adapter.invalidateUnreadCount(userId);
      return 3;
    };

    // When
    const counted = await adapter.wrapUnreadCount(userId, countBeforeCommit);
    const next = await adapter.wrapUnreadCount(userId, async () => 4);

    // Then
    expect([counted, next]).toEqual([3, 4]);
  });

  it("무효화는 전체·옛 범위 미읽음 수를 함께 비운다", async () => {
    // Given
    const adapter = new NotificationCacheAdapter(
      new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
    );
    const userId = UserId.reconstitute("user-1");
    await adapter.wrapUnreadCount(userId, async () => 1, "all");
    await adapter.wrapUnreadCount(userId, async () => 1, "legacy");

    // When
    await adapter.invalidateUnreadCount(userId);

    // Then
    expect([
      await adapter.wrapUnreadCount(userId, async () => 2, "all"),
      await adapter.wrapUnreadCount(userId, async () => 2, "legacy"),
    ]).toEqual([2, 2]);
  });
});
