import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";

import { SessionId } from "../../domain/session-id.vo.js";
import { SessionCacheAdapter } from "./session-cache.adapter.js";

const SESSION_ID = SessionId.reconstitute("session-1");
const VALID_SESSION = {
  userId: "user-1",
  expiresAt: "2026-11-20T00:00:00.000Z",
  revokedAt: null,
};

describe("SessionCacheAdapter — 폐기 뒤 늦은 쓰기", () => {
  it("폐기한 뒤 늦게 도착한 '살아 있음' 쓰기는 세션을 되살리지 않는다", async () => {
    // Given
    const cache = new SessionCacheAdapter(
      new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
    );
    await cache.setSession(SESSION_ID, VALID_SESSION);
    await cache.invalidateSession(SESSION_ID);

    // When
    await cache.setSession(SESSION_ID, VALID_SESSION);
    const afterLateWrite = await cache.getSession(SESSION_ID);

    // Then
    expect(afterLateWrite).toBeNull();
  });

  it("폐기하지 않은 세션은 쓴 값을 그대로 읽는다", async () => {
    // Given
    const cache = new SessionCacheAdapter(
      new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
    );

    // When
    await cache.setSession(SESSION_ID, VALID_SESSION);

    // Then
    expect(await cache.getSession(SESSION_ID)).toEqual(VALID_SESSION);
  });
});
