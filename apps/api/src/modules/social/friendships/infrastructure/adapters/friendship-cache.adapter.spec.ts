import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { invalidateFriendshipCaches } from "../../application/ports/friendship-cache.port.js";
import { FriendshipCacheAdapter } from "./friendship-cache.adapter.js";

function createAdapter(): FriendshipCacheAdapter {
  return new FriendshipCacheAdapter(
    new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
  );
}

describe("FriendshipCacheAdapter — 친구 id 목록·수 캐시", () => {
  const userId = UserId.reconstitute("user-1");
  const friendId = UserId.reconstitute("friend-1");

  it("친구 id를 읽는 동안 친구 관계가 커밋해 무효화되면 읽은 목록을 남기지 않는다", async () => {
    // Given
    const adapter = createAdapter();
    const readBeforeCommit = async () => {
      await invalidateFriendshipCaches(adapter, userId, friendId);
      return [];
    };

    // When
    await adapter.wrapMutualFriendIds(userId, readBeforeCommit);
    const next = await adapter.wrapMutualFriendIds(userId, async () => [friendId.value]);

    // Then
    expect(next).toEqual([friendId.value]);
  });

  it("친구 수를 세는 동안 친구 관계가 커밋해 무효화되면 센 값을 남기지 않는다", async () => {
    // Given
    const adapter = createAdapter();
    const countBeforeCommit = async () => {
      await invalidateFriendshipCaches(adapter, userId, friendId);
      return 0;
    };

    // When
    await adapter.wrapFriendCount(userId, countBeforeCommit);
    const next = await adapter.wrapFriendCount(userId, async () => 1);

    // Then
    expect(next).toBe(1);
  });
});
