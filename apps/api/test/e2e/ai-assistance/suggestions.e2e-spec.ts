import {
  recurringSuggestionSchema,
  suggestionAnalysisResponseSchema,
  suggestionListResponseSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import request from "supertest";
import { z } from "zod";

import { EntitlementCacheKey } from "#api/modules/access/feature-grants/infrastructure/cache/entitlement-cache.keyspace";
import { AiGeneratorPort } from "#api/modules/ai-assistance/ai-generations/ai-assistance-ai-generations.public";
import { AI_SUGGESTION_QUEUE } from "#api/modules/ai-assistance/suggestions/infrastructure/jobs/ai-suggestion.queue";
import {
  type CreateTodoData,
  type StagedTodoCreation,
  StagedTodoCreatorPort,
} from "#api/modules/planning/todos/application/ports/staged-todo-creator.port";
import { StagedTodoCreatorAdapter } from "#api/modules/planning/todos/infrastructure/adapters/staged-todo-creator.adapter";
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
  suggestion as suggestionTable,
  todo,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import type { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { nowInstant, todayUtc } from "#test/fixtures/clock.fixture";
import { TodoFixture } from "#test/fixtures/todo.fixture";

import { FakeAiGenerator } from "../../mocks/fake-ai.generator.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "../helpers/index.js";

// 실제 할 일 생성 경로를 그대로 쓰고 다음 한 번만 실패를 넣는다
@Injectable()
class FailableStagedTodoCreator extends StagedTodoCreatorAdapter {
  #nextFailure: Error | null = null;

  failNextStage(error: Error): void {
    this.#nextFailure = error;
  }

  override async stage(input: CreateTodoData): Promise<StagedTodoCreation> {
    const failure = this.#nextFailure;
    if (failure != null) {
      this.#nextFailure = null;
      throw failure;
    }
    return super.stage(input);
  }
}

describe("AI 제안 E2E", () => {
  let testContext: E2eTestContext;
  let fakeAiGenerator: FakeAiGenerator;

  beforeAll(async () => {
    fakeAiGenerator = new FakeAiGenerator();

    testContext = await createE2eApp({
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(AiGeneratorPort)
          .useValue(fakeAiGenerator)
          .overrideProvider(StagedTodoCreatorPort)
          .useClass(FailableStagedTodoCreator),
      additionalResetters: [() => fakeAiGenerator.clear()],
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  /** 프리미엄 사용자를 생성하고 토큰을 반환하는 헬퍼 */
  async function createPremiumUser(email: string, password: string) {
    const user = await testContext.helpers.createVerifiedUser(email, password);
    await testContext.testDatabase
      .getClient()
      .update(userTable)
      .set({ subscriptionStatus: "ACTIVE" })
      .where(eq(userTable.id, user.userId));
    const cacheService = testContext.module.get(CacheStorePort);
    await cacheService.del(EntitlementCacheKey.subscription(user.userId));
    return user;
  }

  async function setSubscriptionStatus(userId: string, subscriptionStatus: "ACTIVE" | "EXPIRED") {
    await testContext.testDatabase
      .getClient()
      .update(userTable)
      .set({ subscriptionStatus })
      .where(eq(userTable.id, userId));
    await testContext.module.get(CacheStorePort).del(EntitlementCacheKey.subscription(userId));
  }

  async function seedRecentTodo(userId: string, accessToken: string) {
    const categoryId = await testContext.helpers.getDefaultCategoryId(accessToken);
    const { id: _id, ...row } = TodoFixture.create({
      userId,
      categoryId,
      title: "책 읽기",
      startDate: todayUtc(),
    });
    await testContext.testDatabase.getClient().insert(todo).values(row);
  }

  function analysisJobs() {
    return testContext.module
      .get<typeof JobQueuePort, InMemoryJobQueue>(JobQueuePort)
      .jobsIn(AI_SUGGESTION_QUEUE);
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
    const db = testContext.testDatabase.getClient();
    const [suggestion] = await db
      .insert(suggestionTable)
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
      .returning({ id: suggestionTable.id });
    if (suggestion === undefined) {
      throw new Error("제안 시드가 생성되지 않았습니다.");
    }
    return suggestion.id;
  }

  describe("GET /ai/suggestions", () => {
    it("200: 할 일을 적지 않은 사용자는 빈 제안 목록과 할 일을 적어 달라는 분석 상태를 받는다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-list@example.com", "Test1234!");

      // When
      const response = await request(testContext.app.getHttpServer())
        .get("/v1/ai/suggestions")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(200);
      const data = suggestionListResponseSchema.parse(response.body.data);
      expect(data.suggestions).toEqual([]);
      expect(response.body.data.analysis).toEqual({
        state: "NEEDS_MORE_TODOS",
        canRequestNow: false,
        nextAnalysisAt: expect.any(String),
      });
    });

    it("401: 인증 토큰 없이 요청 시 에러를 반환해야 한다", async () => {
      // Given

      // When
      const response = await request(testContext.app.getHttpServer()).get("/v1/ai/suggestions");

      // Then
      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /ai/suggestions/:id", () => {
    it("200(accept): 제안 수락 시 ACCEPTED로 전이되고 반복 할 일이 생성된다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-accept@example.com", "Test1234!");
      const categoryId = await testContext.helpers.getDefaultCategoryId(user.accessToken);
      const suggestionId = await seedPendingSuggestion(user.userId);

      // When
      const response = await request(testContext.app.getHttpServer())
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
      const categoryId = await testContext.helpers.getDefaultCategoryId(user.accessToken);
      const suggestionId = await seedPendingSuggestion(user.userId);
      await testContext.testDatabase
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
      const response = await request(testContext.app.getHttpServer())
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
      const response = await request(testContext.app.getHttpServer())
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
      const categoryId = await testContext.helpers.getDefaultCategoryId(user.accessToken);
      const suggestionId = await seedPendingSuggestion(user.userId, {
        status: "ACCEPTED",
      });

      // When
      const response = await request(testContext.app.getHttpServer())
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
      const response = await request(testContext.app.getHttpServer())
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
      const response = await request(testContext.app.getHttpServer())
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
      const response = await request(testContext.app.getHttpServer())
        .patch("/v1/ai/suggestions/1")
        .send({ action: "dismiss" });

      // Then
      expect(response.status).toBe(401);
    });
  });

  describe("POST /ai/suggestions/analyses", () => {
    it("202: 두 번 눌러도 오늘 분석 job은 같은 하루 key로 1개이고 상태는 분석 중이다", async () => {
      // Given
      const user = await createPremiumUser("ai-suggestion-request@example.com", "Test1234!");
      await seedRecentTodo(user.userId, user.accessToken);

      // When
      const responses = [];
      for (const _press of [1, 2]) {
        responses.push(
          await request(testContext.app.getHttpServer())
            .post("/v1/ai/suggestions/analyses")
            .set("Authorization", `Bearer ${user.accessToken}`),
        );
      }

      // Then
      for (const response of responses) {
        expect(response.status).toBe(202);
        expect(suggestionAnalysisResponseSchema.parse(response.body.data).analysis).toMatchObject({
          state: "ANALYZING",
          canRequestNow: false,
        });
      }
      expect(analysisJobs()).toEqual([
        expect.objectContaining({
          payload: expect.objectContaining({
            data: expect.objectContaining({ userId: user.userId, trigger: "ON_DEMAND" }),
          }),
          options: expect.objectContaining({
            idempotencyKey: expect.stringMatching(
              new RegExp(`^suggestion_${user.userId}_\\d{4}-\\d{2}-\\d{2}$`),
            ),
            priority: 10,
          }),
        }),
      ]);
    });

    it("403: 무료 사용자는 AI_1309이고 job을 넣지 않는다", async () => {
      // Given
      const user = await testContext.helpers.createVerifiedUser(
        "ai-suggestion-request-free@example.com",
        "Test1234!",
      );

      // When
      const response = await request(testContext.app.getHttpServer())
        .post("/v1/ai/suggestions/analyses")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(ErrorCode.AI_1309);
      expect(analysisJobs()).toEqual([]);
    });

    it("403: 1.13.0 이상 앱에서 AI 데이터 처리에 동의하지 않았으면 AI_1311이다", async () => {
      // Given
      const user = await createPremiumUser(
        "ai-suggestion-request-consent@example.com",
        "Test1234!",
      );
      await seedRecentTodo(user.userId, user.accessToken);

      // When
      const response = await request(testContext.app.getHttpServer())
        .post("/v1/ai/suggestions/analyses")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-App-Version", "1.16.0");

      // Then
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(ErrorCode.AI_1311);
      expect(analysisJobs()).toEqual([]);
    });
  });

  it("구독이 끝나면 조회·분석 요청이 AI_1309이고 대기 제안은 남아 다시 구독하면 그대로 보인다", async () => {
    // Given
    const user = await createPremiumUser("ai-suggestion-expired@example.com", "Test1234!");
    const suggestionId = await seedPendingSuggestion(user.userId);
    await setSubscriptionStatus(user.userId, "EXPIRED");

    // When
    const expiredList = await request(testContext.app.getHttpServer())
      .get("/v1/ai/suggestions")
      .set("Authorization", `Bearer ${user.accessToken}`);
    const expiredRequest = await request(testContext.app.getHttpServer())
      .post("/v1/ai/suggestions/analyses")
      .set("Authorization", `Bearer ${user.accessToken}`);
    await setSubscriptionStatus(user.userId, "ACTIVE");
    const renewedList = await request(testContext.app.getHttpServer())
      .get("/v1/ai/suggestions")
      .set("Authorization", `Bearer ${user.accessToken}`);

    // Then
    for (const response of [expiredList, expiredRequest]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(ErrorCode.AI_1309);
    }
    expect(renewedList.status).toBe(200);
    const renewed = suggestionListResponseSchema.parse(renewedList.body.data);
    expect(renewed.suggestions.map(({ id }) => id)).toEqual([suggestionId]);
    expect(renewed.analysis?.state).toBe("HAS_SUGGESTIONS");
  });

  it("출시 앱(1.15.x) 요청 모양의 목록 조회는 analysis·evidence를 몰라도 그대로 읽힌다", async () => {
    // Given
    const user = await createPremiumUser("ai-suggestion-released-app@example.com", "Test1234!");
    await seedPendingSuggestion(user.userId);
    const releasedAppListSchema = z.object({
      suggestions: z.array(recurringSuggestionSchema.omit({ evidence: true })),
    });

    // When
    const response = await request(testContext.app.getHttpServer())
      .get("/v1/ai/suggestions")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("X-Timezone", "Asia/Seoul");

    // Then
    expect(response.status).toBe(200);
    expect(releasedAppListSchema.parse(response.body.data).suggestions).toEqual([
      expect.objectContaining({ title: "팀 미팅", status: "PENDING" }),
    ]);
  });

  it("비프리미엄 제안 조회·행동은 없는 ID보다 AI_1309를 우선한다", async () => {
    // Given
    const user = await testContext.helpers.createVerifiedUser(
      "ai-suggestion-free@example.com",
      "Test1234!",
    );

    // When
    const list = await request(testContext.app.getHttpServer())
      .get("/v1/ai/suggestions")
      .set("Authorization", `Bearer ${user.accessToken}`);
    const action = await request(testContext.app.getHttpServer())
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
    const response = await request(testContext.app.getHttpServer())
      .patch(`/v1/ai/suggestions/${id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ action: "dismiss" });

    // Then
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("AI_1305");
    const row = await testContext.testDatabase.getClient().query.suggestion.findFirst({
      where: { id },
    });
    expect(row?.status).toBe("PENDING");
  });

  it("반복 할 일 생성 실패는 실제 HTTP 뒤에도 pending 행과 Todo 개수를 보존한다", async () => {
    // Given
    const user = await createPremiumUser("ai-suggestion-failure@example.com", "Test1234!");
    const categoryId = await testContext.helpers.getDefaultCategoryId(user.accessToken);
    const id = await seedPendingSuggestion(user.userId);
    const creator = testContext.module.get<StagedTodoCreatorPort>(StagedTodoCreatorPort);
    if (!(creator instanceof FailableStagedTodoCreator)) {
      throw new Error("실패를 넣을 수 있는 할 일 생성기로 바꾸지 않았다");
    }
    const before = await testContext.testDatabase
      .getClient()
      .query.todo.findMany({ where: { userId: user.userId } });
    creator.failNextStage(new Error("테스트 생성 실패"));

    // When
    const response = await request(testContext.app.getHttpServer())
      .patch(`/v1/ai/suggestions/${id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ action: "accept", categoryId });

    // Then
    expect(response.status).toBe(500);
    const row = await testContext.testDatabase.getClient().query.suggestion.findFirst({
      where: { id },
    });
    expect(row?.status).toBe("PENDING");
    const after = await testContext.testDatabase
      .getClient()
      .query.todo.findMany({ where: { userId: user.userId } });
    expect(after).toHaveLength(before.length);
  });
});
