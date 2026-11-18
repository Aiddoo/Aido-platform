import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { CachedSession } from "../../application/ports/session-cache.port.js";
import { SessionId } from "../../domain/session-id.vo.js";
import { SessionCacheKey } from "../cache/session-cache.keyspace.js";
import { SessionCacheAdapter } from "./session-cache.adapter.js";

const SESSION_ID = SessionId.reconstitute("session-1");
const VALID_SESSION: CachedSession = {
  userId: UserId.reconstitute("user-1"),
  expiresAt: "2026-11-20T00:00:00.000Z",
  revokedAt: null,
};
const ROTATED_SESSION: CachedSession = { ...VALID_SESSION, expiresAt: "2026-11-27T00:00:00.000Z" };

function setUp() {
  const store = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
  return { store, cache: new SessionCacheAdapter(store) };
}

describe("SessionCacheAdapter — 폐기·회전과 늦은 저장", () => {
  it("DB를 읽는 사이 폐기되면 읽은 '살아 있음' 값을 저장하지 않는다", async () => {
    // Given
    const { store, cache } = setUp();
    const readBeforeRevoke = async () => {
      await cache.invalidateSession(SESSION_ID);
      return VALID_SESSION;
    };

    // When
    const lateRead = await cache.wrapSession(SESSION_ID, readBeforeRevoke);
    const storedAfterRevoke = await store.has(SessionCacheKey.session(SESSION_ID.value));

    // Then
    expect(lateRead).toEqual(VALID_SESSION);
    expect(storedAfterRevoke).toBe(false);
  });

  it("폐기한 세션은 캐시에서 지워 다음 확인이 DB를 다시 읽는다", async () => {
    // Given
    const { cache } = setUp();
    await cache.wrapSession(SESSION_ID, async () => VALID_SESSION);
    const reads: string[] = [];

    // When
    await cache.invalidateSession(SESSION_ID);
    await cache.wrapSession(SESSION_ID, async () => {
      reads.push("database");
      return VALID_SESSION;
    });

    // Then
    expect(reads).toEqual(["database"]);
  });

  it("회전으로 지운 세션은 세대를 바꾸지 않아 다음 확인이 새 만료 시각을 다시 캐시한다", async () => {
    // Given
    const { cache } = setUp();
    await cache.wrapSession(SESSION_ID, async () => VALID_SESSION);

    // When
    await cache.evictSession(SESSION_ID);
    const refreshed = await cache.wrapSession(SESSION_ID, async () => ROTATED_SESSION);
    const cached = await cache.wrapSession(SESSION_ID, async () => VALID_SESSION);

    // Then
    expect(refreshed).toEqual(ROTATED_SESSION);
    expect(cached).toEqual(ROTATED_SESSION);
  });
});
