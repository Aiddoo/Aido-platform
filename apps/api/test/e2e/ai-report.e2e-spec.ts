import { eq } from "drizzle-orm";
import request from "supertest";
import { assert } from "vitest";

import { EntitlementCacheKey } from "#api/modules/access/entitlements/infrastructure/cache/entitlement-cache.keyspace";
import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { GenerateReportUseCase } from "#api/modules/ai-assistance/reports/application/use-cases/generate-report.use-case";
import { toAiReportResponse } from "#api/modules/ai-assistance/reports/presentation/http/v1/ai-report-response.mapper";
/**
 * AI 리포트 모듈 E2E 테스트
 *
 * @description
 * AI 리포트 API의 전체 HTTP 요청/응답 플로우 테스트.
 * FakeAiGenerator를 사용하여 실제 Gemini API 호출을 모킹합니다.
 *
 * ### 테스트 범위
 * - GET /ai/reports/status: 리포트 상태 조회
 * - GET /ai/reports: 리포트 목록 조회
 * - GET /ai/reports/:id: 리포트 상세 조회
 * - 인증 에러 (401)
 */
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { todo, todoCategory, user as userTable } from "#api/platform/database/schema/index";
import { createReportAiResponse } from "#test/fixtures/ai-response.fixture";
import { TodoFixture } from "#test/fixtures/todo.fixture";

import { FakeAiGenerator } from "../mocks/fake-ai.generator.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("AI 리포트 E2E", () => {
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

  describe("GET /ai/reports/status", () => {
    it("200: 다음 리포트 예정일을 포함한 상태를 반환해야 한다", async () => {
      // Given
      const user = await createPremiumUser("ai-report-status@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports/status")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul");

      // Then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const status = response.body.data.status;
      expect(status.nextWeeklyAt).toBeDefined();
      expect(status.nextMonthlyAt).toBeDefined();
      expect(status.daysUntilWeekly).toBeGreaterThanOrEqual(0);
      expect(status.daysUntilMonthly).toBeGreaterThanOrEqual(0);
      expect(status.latestWeekly).toBeNull();
      expect(status.latestMonthly).toBeNull();
    });

    it("401: 인증 토큰 없이 요청 시 에러를 반환해야 한다", async () => {
      // When
      const response = await request(ctx.app.getHttpServer()).get("/v1/ai/reports/status");

      // Then
      expect(response.status).toBe(401);
    });
  });

  describe("GET /ai/reports", () => {
    it("200: 빈 리포트 목록을 반환해야 한다 (초기 상태)", async () => {
      // Given
      const user = await createPremiumUser("ai-report-list@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reports).toEqual([]);
    });

    it("200: type 필터를 적용하여 조회할 수 있어야 한다", async () => {
      // Given
      const user = await createPremiumUser("ai-report-filter@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports?type=WEEKLY&limit=5")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.reports).toEqual([]);
    });

    it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
      // When
      const response = await request(ctx.app.getHttpServer()).get("/v1/ai/reports");

      // Then
      expect(response.status).toBe(401);
    });
  });

  describe("GET /ai/reports/:id", () => {
    it("404: 존재하지 않는 리포트 조회 시 에러를 반환해야 한다", async () => {
      // Given
      const user = await createPremiumUser("ai-report-404@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports/99999")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("AI_1304");
    });

    it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
      // When
      const response = await request(ctx.app.getHttpServer()).get("/v1/ai/reports/1");

      // Then
      expect(response.status).toBe(401);
    });

    it("400: 유효하지 않은 ID 형식 시 에러를 반환해야 한다", async () => {
      // Given
      const user = await createPremiumUser("ai-report-invalid@example.com", "Test1234!");

      // When
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports/invalid")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(400);
    });
  });

  /** 서울 기준 지난 주(7일 전 같은 요일)에 할 일 하나를 기록한다. 활동이 없으면 LLM을 부르지 않는다. */
  async function seedLastWeekTodo(userId: string) {
    const client = ctx.testDatabase.getClient();
    const [category] = await client
      .insert(todoCategory)
      .values({
        userId,
        name: "업무",
        color: "#3B82F6",
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        sortOrder: 99,
      })
      .returning();
    assert.exists(category);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
    const { id: _id, ...row } = TodoFixture.create({
      userId,
      categoryId: category.id,
      title: "주간 리포트 기록",
      startDate: Temporal.PlainDate.from(seoulDate.format(lastWeek)),
    });
    await client.insert(todo).values(row);
  }

  it.each(["ko", "en"] as const)(
    "%s 리포트는 실제 생성·저장 후 소유자 HTTP에 같은 문구로 전달된다",
    async (locale) => {
      // Given
      const user = await createPremiumUser(`ai-report-${locale}@example.com`, "Test1234!");
      const raw = createReportAiResponse(locale);
      fakeAiGenerator.setRawResponse(raw);
      await seedLastWeekTodo(user.userId);

      // When
      const report = await ctx.module
        .get(GenerateReportUseCase)
        .execute({ userId: user.userId, timezone: "Asia/Seoul", type: "WEEKLY", locale });
      assert.exists(report);
      const response = await request(ctx.app.getHttpServer())
        .get(`/v1/ai/reports/${report.id.value}`)
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.report.aiSummary).toBe(raw.insight);
      expect(response.body.data.report.aiTips).toEqual(raw.tips);
      // 라벨의 올해는 저장 시간대(테스트 사용자는 기본값 UTC)로 정한다
      expect(response.body.data.report.periodLabel).toBe(
        toAiReportResponse(report, Temporal.Now.plainDateISO("UTC")).periodLabel,
      );
      expect(fakeAiGenerator.getCallCount()).toBe(1);
      const stored = await ctx.testDatabase
        .getClient()
        .query.aiReport.findFirst({ where: { id: report.id.value } });
      expect(stored).toMatchObject({ locale, contentSource: "AI", promptVersion: "report@5" });

      // When
      const other = await createPremiumUser(`ai-report-other-${locale}@example.com`, "Test1234!");
      const denied = await request(ctx.app.getHttpServer())
        .get(`/v1/ai/reports/${report.id.value}`)
        .set("Authorization", `Bearer ${other.accessToken}`);

      // Then
      expect(denied.status).toBe(404);
      expect(denied.body.error.code).toBe("AI_1304");
    },
  );

  it("비프리미엄 리포트 조회는 없는 ID보다 AI_1308을 우선한다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("ai-report-free@example.com", "Test1234!");
    // When
    for (const route of ["/v1/ai/reports/status", "/v1/ai/reports", "/v1/ai/reports/999999"]) {
      const response = await request(ctx.app.getHttpServer())
        .get(route)
        .set("Authorization", `Bearer ${user.accessToken}`);
      // Then
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("AI_1308");
    }
    expect(fakeAiGenerator.getCallCount()).toBe(0);
  });

  it("구독이 끝난 사용자는 리포트 목록·상세가 AI_1308이고 저장된 리포트는 남는다", async () => {
    // Given
    const user = await createPremiumUser("ai-report-expired@example.com", "Test1234!");
    fakeAiGenerator.setRawResponse(createReportAiResponse("ko"));
    await seedLastWeekTodo(user.userId);
    const report = await ctx.module
      .get(GenerateReportUseCase)
      .execute({ userId: user.userId, timezone: "Asia/Seoul", type: "WEEKLY", locale: "ko" });
    assert.exists(report);
    await ctx.testDatabase
      .getClient()
      .update(userTable)
      .set({ subscriptionStatus: "EXPIRED" })
      .where(eq(userTable.id, user.userId));
    await ctx.module.get(CacheStorePort).del(EntitlementCacheKey.subscription(user.userId));

    // When
    for (const route of ["/v1/ai/reports", `/v1/ai/reports/${report.id.value}`]) {
      const response = await request(ctx.app.getHttpServer())
        .get(route)
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("AI_1308");
    }
    const stored = await ctx.testDatabase
      .getClient()
      .query.aiReport.findFirst({ where: { id: report.id.value } });
    expect(stored).toBeDefined();
  });
});
