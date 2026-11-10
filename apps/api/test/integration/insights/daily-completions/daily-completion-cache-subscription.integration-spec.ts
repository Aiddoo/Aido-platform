import { Injectable } from "@nestjs/common";
import request from "supertest";

import { DailyCompletionCachePort } from "#api/modules/insights/daily-completions/application/ports/daily-completion-cache.port";
import { DailyCompletionCache } from "#api/modules/insights/daily-completions/infrastructure/cache/daily-completion.cache";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  DomainEventPublisherPort,
  type PublishedDomainEvent,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

@Injectable()
class CountingDailyCompletionCache extends DailyCompletionCache {
  readonly invalidatedUserIds: string[] = [];

  constructor(store: CacheStorePort) {
    super(store);
  }

  override async invalidate(userId: UserId): Promise<void> {
    this.invalidatedUserIds.push(userId.value);
    await super.invalidate(userId);
  }
}

function todoCompleted(userId: string): PublishedDomainEvent {
  return {
    eventName: "planning.todo.completed",
    eventId: "event-rollback",
    occurredAt: Temporal.Instant.from("2026-11-10T00:00:00Z"),
    toPayload: () => ({ todoId: 1, userId, occurredAt: "2026-11-10T00:00:00.000Z" }),
  };
}

describe("일간 완료 캐시의 커밋 뒤 구독 (실제 앱·PostgreSQL)", () => {
  let context: E2eTestContext;
  let cache: CountingDailyCompletionCache;

  beforeAll(async () => {
    context = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(DailyCompletionCachePort).useClass(CountingDailyCompletionCache),
    });
    const resolved = context.module.get(DailyCompletionCachePort);
    if (!(resolved instanceof CountingDailyCompletionCache)) {
      throw new Error("일간 완료 캐시를 세는 double로 바꾸지 못했습니다.");
    }
    cache = resolved;
  }, 60_000);

  beforeEach(async () => {
    await context.reset();
    cache.invalidatedUserIds.length = 0;
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  it("할 일 완료를 커밋하면 그 사용자의 캐시를 한 번만 지운다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("cache-once@example.com", "Password1!");
    const categoryId = await context.helpers.getDefaultCategoryId(user.accessToken);
    const created = await request(context.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "산책", startDate: "2026-11-10", categoryId })
      .expect(201);
    cache.invalidatedUserIds.length = 0;

    // When
    await request(context.app.getHttpServer())
      .patch(`/v1/todos/${created.body.data.todo.id}/complete`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ completed: true })
      .expect(200);

    // Then
    expect(cache.invalidatedUserIds).toEqual([user.userId]);
  });

  it("트랜잭션이 rollback되면 캐시를 지우지 않는다", async () => {
    // Given
    const unitOfWork = context.module.get(UnitOfWorkPort);
    const publisher = context.module.get(DomainEventPublisherPort);

    // When
    await unitOfWork
      .run(async () => {
        await publisher.publish([todoCompleted("rolled-back-user")]);
        throw new Error("rollback");
      })
      .catch(() => undefined);

    // Then
    expect(cache.invalidatedUserIds).toEqual([]);
  });
});
