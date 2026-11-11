import { EventEmitter2 } from "@nestjs/event-emitter";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createDailyCompletionRangeFixture,
  DAILY_COMPLETION_FIXTURE_FRIEND_ID,
  DAILY_COMPLETION_FIXTURE_USER_ID,
} from "#test/fixtures/insights/daily-completion.fixture";

import { DailyCompletionLogEvent } from "../../application/daily-completions.log-events.js";
import { DailyCompletionCachePort } from "../../application/ports/daily-completion-cache.port.js";
import { DailyCompletionCache } from "../cache/daily-completion.cache.js";
import {
  DAILY_COMPLETION_CACHE_SUBSCRIPTIONS,
  DailyCompletionCacheEventHandler,
} from "./daily-completion-cache.event-handler.js";

const OWNER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID);
const OTHER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_FRIEND_ID);

class FailingDailyCompletionCache extends DailyCompletionCachePort {
  readRange(): never {
    throw new Error("not used");
  }

  storeRangeIfCurrent(): never {
    throw new Error("not used");
  }

  readPublicRange(): never {
    throw new Error("not used");
  }

  storePublicRangeIfCurrent(): never {
    throw new Error("not used");
  }

  async invalidate(): Promise<void> {
    throw new Error("private cache payload");
  }
}

describe("DailyCompletionCacheEventHandler", () => {
  it.each(DAILY_COMPLETION_CACHE_SUBSCRIPTIONS.map(({ name }) => name))(
    "%s 전달이 그 사용자의 본인·공개 집계만 버린다",
    async (channel) => {
      // Given
      const cache = new DailyCompletionCache(
        new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 }),
      );
      const value = createDailyCompletionRangeFixture();
      for (const userId of [OWNER, OTHER]) {
        const read = await cache.readRange(userId, value.range);
        await cache.storeRangeIfCurrent(userId, read.generation, value);
        await cache.storePublicRangeIfCurrent(userId, read.generation, value);
      }
      const eventEmitter = new EventEmitter2();
      new DailyCompletionCacheEventHandler({
        dailyCompletionCache: cache,
        eventEmitter,
        logger: new SilentLogger(),
      }).onModuleInit();

      // When
      await eventEmitter.emitAsync(channel, { userId: OWNER.value });

      // Then
      expect((await cache.readRange(OWNER, value.range)).value).toBeNull();
      expect((await cache.readPublicRange(OWNER, value.range)).value).toBeNull();
      expect((await cache.readRange(OTHER, value.range)).value).not.toBeNull();
      expect((await cache.readPublicRange(OTHER, value.range)).value).not.toBeNull();
    },
  );

  it("무효화가 실패해도 전달로 번지지 않고 오류 원문 없이 실패 맥락만 남긴다", async () => {
    // Given
    const logger = new SilentLogger();
    const handler = new DailyCompletionCacheEventHandler({
      dailyCompletionCache: new FailingDailyCompletionCache(),
      eventEmitter: new EventEmitter2(),
      logger,
    });

    // When
    const handled = handler.handle({ userId: OWNER.value });

    // Then
    await expect(handled).resolves.toBeUndefined();
    expect(logger.messages).toEqual([
      {
        event: DailyCompletionLogEvent.CACHE_INVALIDATION_FAILED,
        userId: OWNER.value,
        errorType: "Error",
      },
    ]);
  });
});
