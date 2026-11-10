import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";

import { TODO_CATEGORY_EVENTS } from "#api/modules/planning/categories/planning-categories.public";
import { TODO_EVENTS, TodoCreatedEvent } from "#api/modules/planning/todos/planning-todos.public";
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
import { DailyCompletionCacheEventHandler } from "./daily-completion-cache.event-handler.js";

const OWNER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID);
const OTHER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_FRIEND_ID);
const SOURCE_EVENTS = [
  TODO_EVENTS.CREATED,
  TODO_EVENTS.OCCURRENCES_CREATED,
  TODO_EVENTS.OCCURRENCES_CHANGED,
  TODO_EVENTS.DELETED,
  TODO_EVENTS.TOGGLED,
  TODO_EVENTS.RESCHEDULED,
  TODO_EVENTS.UPDATED,
  TODO_EVENTS.CATEGORY_CHANGED,
  TODO_EVENTS.VISIBILITY_CHANGED,
  TODO_CATEGORY_EVENTS.UPDATED,
  TODO_CATEGORY_EVENTS.DELETED,
];

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
  let module: TestingModule | undefined;

  afterEach(async () => {
    await module?.close();
    module = undefined;
  });

  it.each(SOURCE_EVENTS)("%s 이벤트가 그 사용자의 본인·공개 집계만 버린다", async (eventName) => {
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
    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        {
          provide: DailyCompletionCacheEventHandler,
          useValue: new DailyCompletionCacheEventHandler({
            dailyCompletionCache: cache,
            logger: new SilentLogger(),
          }),
        },
      ],
    }).compile();
    await module.init();

    // When
    await module.get(EventEmitter2).emitAsync(eventName, { userId: OWNER.value });

    // Then
    expect((await cache.readRange(OWNER, value.range)).value).toBeNull();
    expect((await cache.readPublicRange(OWNER, value.range)).value).toBeNull();
    expect((await cache.readRange(OTHER, value.range)).value).not.toBeNull();
    expect((await cache.readPublicRange(OTHER, value.range)).value).not.toBeNull();
  });

  it("무효화가 실패해도 이벤트 발행으로 번지지 않고 오류 원문 없이 실패 맥락만 남긴다", async () => {
    // Given
    const logger = new SilentLogger();
    const handler = new DailyCompletionCacheEventHandler({
      dailyCompletionCache: new FailingDailyCompletionCache(),
      logger,
    });

    // When
    const handled = handler.handle(new TodoCreatedEvent(1, OWNER.value, null));

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
