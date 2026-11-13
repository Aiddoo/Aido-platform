import { ErrorCode } from "@aido/api/errors";
import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { EntitlementCacheKey } from "#api/modules/access/entitlements/infrastructure/cache/entitlement-cache.keyspace";
import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { StagedTodoCreatorPort } from "#api/modules/planning/todos/application/ports/staged-todo-creator.port";
/**
 * AI 반복 제안 모듈 E2E 테스트
 *
 * @description
 * AI 반복 제안 API의 전체 HTTP 요청/응답 플로우 테스트.
 * FakeAiGenerator를 사용하여 실제 Gemini API 호출을 모킹합니다.
 *
 * ### 테스트 범위
 * - GET /ai/suggestions: 대기 중인 제안 목록 조회
 * - PATCH /ai/suggestions/:id: 제안 수락/거절
 * - 인증 에러 (401)
 */
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import {
  recurringSuggestion,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { nowInstant, todayUtc } from "#test/fixtures/clock.fixture";

import { FakeAiGenerator } from "../mocks/fake-ai.generator.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("AI 제안 E2E", () => {
  let ctx: E2eTestContext;
  let fakeAiGenerator: FakeAiGenerator;

  beforeAll(async () => {
    fakeAiGenerator = new FakeAiGenerator();

    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(AiGeneratorPort).useValue(fakeAiGenerator),
      additionalResetters: [() => fakeAiGenerator.clear()],
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  /** 프리미엄 사용자를 생성하고 토큰을 반환하는 헬퍼 */
  async function createPremiumUser(email: string, password: string) {
    const user = await ctx.helpers.createVerifiedUser(email, password);
    await ctx.testDatabase
      .getClient()
      .update(userTable)
      .set({ subscriptionStatus: "ACTIVE" })
      .where(eq(userTable.id, user.userId));
    const cacheService = ctx.module.get(CacheStorePort);
    await cacheService.del(EntitlementCacheKey.subscription(user.userId));
    return user;
  }

  /** PENDING 상태의 AI 제안 행을 직접 시딩하고 ID를 반환하는 헬퍼 */
  async function seedPendingSuggestion(
    userId: string,
    overrides?: {
      status?: "PENDING" | "ACCEPTED" | "DISMISSED";
      daysOfWeek?: string[];
      scheduledTime?: string | null;
    },
  ): Promise<number> {
    const db = ctx.testDatabase.getClient();
    const [suggestion] = await db
      .insert(recurringSuggestion)
      .values({
        userId,
        title: "팀 미팅",
        daysOfWeek: overrides?.daysOfWeek ?? ["MON", "WED", "FRI"],
        scheduledTime: overrides?.scheduledTime === undefined ? "10:00" : overrides.scheduledTime,
        confidence: 0.85,
        reason: "최근 2주간 반복 패턴 감지",
        matchedTodos: [],
        suggestedCategoryId: null,
        status: overrides?.status ?? "PENDING",
        expiresAt: Temporal.Now.instant().add({ hours: 14 * 24 }),
        updatedAt: Temporal.Now.instant(),
      })
      .returning({ id: recurringSuggestion.id });
    if (suggestion === undefined) {
      throw new Error("제안 시드가 생성되지 않았습니다.");
    }
    return suggestion.id;
  }

  describe("GET /ai/suggestions", () => {
    it("200: 빈 제안 목록을 반환해야 한다 (초기 상태)", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-list@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/suggestions")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toEqual([]);
    });

    it("401: 인증 토큰 없이 요청 시 에러를 반환해야 한다", async () => {
      // Given

      // When
      const response = await request(ctx.app.getHttpServer()).get("/v1/ai/suggestions");

      // Then
      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /ai/suggestions/:id", () => {
    it("200(accept): 제안 수락 시 ACCEPTED로 전이되고 반복 할 일이 생성된다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-accept@example.com", "Test1234!");
      const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
      const suggestionId = await seedPendingSuggestion(user.userId);

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/ai/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ action: "accept", categoryId });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestion.status).toBe("ACCEPTED");
      expect(response.body.data.createdTodosCount).toBeGreaterThan(0);
    });

    it("403(accept): 옛 경로 상한까지 찬 사용자는 옛 앱이 아는 TODO_0813으로 거절한다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-cap@example.com", "Test1234!");
      const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
      const suggestionId = await seedPendingSuggestion(user.userId);
      await ctx.testDatabase
        .getClient()
        .insert(todoSeries)
        .values(
          Array.from({ length: TODO_SERIES_LIMITS.MAX_ACTIVE_PER_USER_LEGACY }, () => {
            const id = createEntityId();
            return {
              id,
              originSeriesId: id,
              userId: user.userId,
              categoryId,
              title: "시드",
              timezone: "UTC",
              repeatFrequency: "DAILY" as const,
              startDate: todayUtc(),
              nextOccurrenceDate: todayUtc(),
              updatedAt: nowInstant(),
            };
          }),
        );

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/ai/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ action: "accept", categoryId });

      // Then
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(ErrorCode.TODO_0813);
    });

    it("200(dismiss): 제안 거절 시 DISMISSED로 전이되고 할 일은 생성되지 않는다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-dismiss@example.com", "Test1234!");
      const suggestionId = await seedPendingSuggestion(user.userId);

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/ai/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ action: "dismiss" });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.suggestion.status).toBe("DISMISSED");
      expect(response.body.data.createdTodosCount).toBeUndefined();
    });

    it("409: 이미 처리된 제안 재처리 시 에러를 반환해야 한다 (AI_1306)", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-409@example.com", "Test1234!");
      const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
      const suggestionId = await seedPendingSuggestion(user.userId, {
        status: "ACCEPTED",
      });

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/ai/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ action: "accept", categoryId });

      // Then
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("AI_1306");
    });

    it("400: 잘못된 action 값 요청 시 에러를 반환해야 한다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-400@example.com", "Test1234!");
      const suggestionId = await seedPendingSuggestion(user.userId);

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/ai/suggestions/${suggestionId}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ action: "invalid" });

      // Then
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("404: 존재하지 않는 제안에 대해 에러를 반환해야 한다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-404@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch("/v1/ai/suggestions/99999")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ action: "dismiss" });

      // Then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("AI_1305");
    });

    it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
      // Given

      // When
      const response = await request(ctx.app.getHttpServer())
        .patch("/v1/ai/suggestions/1")
        .send({ action: "dismiss" });

      // Then
      expect(response.status).toBe(401);
    });
  });

  it("비프리미엄 제안 조회·행동은 없는 ID보다 AI_1309를 우선한다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser(
      "ai-suggestion-free@example.com",
      "Test1234!",
    );

    // When
    const list = await request(ctx.app.getHttpServer())
      .get("/v1/ai/suggestions")
      .set("Authorization", `Bearer ${user.accessToken}`);
    const action = await request(ctx.app.getHttpServer())
      .patch("/v1/ai/suggestions/999999")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ action: "dismiss" });

    // Then
    for (const response of [list, action]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("AI_1309");
    }
  });

  it("다른 프리미엄 사용자의 실제 제안 ID는 AI_1305를 반환한다", async () => {
    // Given
    const owner = await createPremiumUser("ai-suggestion-owner@example.com", "Test1234!");
    const user = await createPremiumUser("ai-suggestion-other@example.com", "Test1234!");
    const id = await seedPendingSuggestion(owner.userId);

    // When
    const response = await request(ctx.app.getHttpServer())
      .patch(`/v1/ai/suggestions/${id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ action: "dismiss" });

    // Then
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("AI_1305");
    const row = await ctx.testDatabase.getClient().query.recurringSuggestion.findFirst({
      where: { id },
    });
    expect(row?.status).toBe("PENDING");
  });

  it("반복 할 일 생성 실패는 실제 HTTP 뒤에도 pending 행과 Todo 개수를 보존한다", async () => {
    // Given
    const user = await createPremiumUser("ai-suggestion-failure@example.com", "Test1234!");
    const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
    const id = await seedPendingSuggestion(user.userId);
    const creator = ctx.module.get<StagedTodoCreatorPort>(StagedTodoCreatorPort);
    const before = await ctx.testDatabase
      .getClient()
      .query.todo.findMany({ where: { userId: user.userId } });
    const failure = vi.spyOn(creator, "stage").mockRejectedValueOnce(new Error("테스트 생성 실패"));
    try {
      // When
      const response = await request(ctx.app.getHttpServer())
        .patch(`/v1/ai/suggestions/${id}`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ action: "accept", categoryId });

      // Then
      expect(response.status).toBe(500);
      const row = await ctx.testDatabase.getClient().query.recurringSuggestion.findFirst({
        where: { id },
      });
      expect(row?.status).toBe("PENDING");
      const after = await ctx.testDatabase
        .getClient()
        .query.todo.findMany({ where: { userId: user.userId } });
      expect(after).toHaveLength(before.length);
    } finally {
      failure.mockRestore();
    }
  });
});
