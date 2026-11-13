import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { NudgeCountCacheAdapter } from "./nudge-count-cache.adapter.js";

const RECEIVER = UserId.reconstitute("receiver-1");
const OTHER = UserId.reconstitute("other-1");

describe("NudgeCountCacheAdapter — 콕 목록 수 캐시", () => {
  it("담은 수는 다시 세지 않고, 버린 사용자만 다음 조회에 다시 센다", async () => {
    // Given
    const cache = new NudgeCountCacheAdapter(
      new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
    );
    let counted = 0;
    const count = async () => {
      counted += 1;
      return { total: 3, unread: counted };
    };
    await cache.wrapReceivedCounts(RECEIVER, count);
    await cache.wrapReceivedCounts(OTHER, count);
    await cache.wrapSentCount(RECEIVER, async () => 5);

    // When
    const cached = await cache.wrapReceivedCounts(RECEIVER, count);
    await cache.invalidate([RECEIVER]);
    const recounted = await cache.wrapReceivedCounts(RECEIVER, count);
    const otherCached = await cache.wrapReceivedCounts(OTHER, count);
    const sentRecounted = await cache.wrapSentCount(RECEIVER, async () => 6);

    // Then
    expect({ cached, recounted, otherCached, sentRecounted }).toEqual({
      cached: { total: 3, unread: 1 },
      recounted: { total: 3, unread: 3 },
      otherCached: { total: 3, unread: 2 },
      sentRecounted: 6,
    });
  });
});
