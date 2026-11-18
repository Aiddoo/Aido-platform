import { EventEmitter2 } from "@nestjs/event-emitter";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { EventSubscriptionCatalog } from "#api/platform/events/event-subscription.catalog";
import { FanOutDomainEventPublisher } from "#api/platform/events/fan-out-domain-event.publisher";
import {
  AfterCommitTaskRegistryPort,
  type AfterCommitTask,
} from "#api/shared/application/ports/after-commit-task.registry.port";
import type { PublishedDomainEvent } from "#api/shared/application/ports/domain-event-publisher.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
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

  async invalidate(_userId: UserId): Promise<void> {
    throw new Error("private cache payload");
  }
}

class CountingDailyCompletionCache extends FailingDailyCompletionCache {
  readonly invalidatedUserIds: string[] = [];

  override async invalidate(userId: UserId): Promise<void> {
    this.invalidatedUserIds.push(userId.value);
  }
}

// ClsUnitOfWork처럼 한 커밋 안에서 합치기 key가 같은 작업은 처음 하나만 두고 커밋 때 실행한다
class OneCommitAfterCommitTasks extends AfterCommitTaskRegistryPort {
  readonly #tasks: AfterCommitTask[] = [];
  readonly #coalesceKeys = new Set<string>();

  register(task: AfterCommitTask, coalesceKey?: string): void {
    if (coalesceKey != null) {
      if (this.#coalesceKeys.has(coalesceKey)) {
        return;
      }
      this.#coalesceKeys.add(coalesceKey);
    }
    this.#tasks.push(task);
  }

  async commit(): Promise<void> {
    for (const task of this.#tasks) {
      await task();
    }
  }
}

function planningFact(
  eventName: string,
  eventId: string,
  payload: Record<string, unknown>,
): PublishedDomainEvent {
  return {
    eventName,
    eventId,
    occurredAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
    toPayload: () => ({ ...payload, occurredAt: "2026-11-10T00:00:00.000Z" }),
  };
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

  it("한 커밋이 이름이 다른 사실 셋을 내도 그 사용자 캐시는 한 번만 지운다", async () => {
    // Given
    const cache = new CountingDailyCompletionCache();
    const eventEmitter = new EventEmitter2();
    new DailyCompletionCacheEventHandler({
      dailyCompletionCache: cache,
      eventEmitter,
      logger: new SilentLogger(),
    }).onModuleInit();
    const afterCommit = new OneCommitAfterCommitTasks();
    const publisher = new FanOutDomainEventPublisher(
      new EventSubscriptionCatalog(DAILY_COMPLETION_CACHE_SUBSCRIPTIONS),
      new InMemoryJobQueue(),
      afterCommit,
      eventEmitter,
    );

    // When
    await publisher.publish([
      planningFact("planning.todo.updated", "event-1", { todoId: 1, userId: OWNER.value }),
      planningFact("planning.todo-series.occurrences-changed", "event-2", {
        seriesId: "series-1",
        userId: OWNER.value,
      }),
      planningFact("planning.todo-category.updated", "event-3", {
        categoryId: 1,
        userId: OWNER.value,
      }),
      planningFact("planning.todo.updated", "event-4", { todoId: 2, userId: OTHER.value }),
    ]);
    await afterCommit.commit();

    // Then
    expect(cache.invalidatedUserIds).toEqual([OWNER.value, OTHER.value]);
  });

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
