import request from "supertest";

import { EntitlementCacheKey } from "#api/modules/access/infrastructure/cache/entitlement/entitlement-cache.keyspace";
import { AI_PROVIDER } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import { GenerateReport } from "#api/modules/ai-assistance/application/use-cases/reports/generate-report.use-case";
/**
 * AI 리포트 모듈 E2E 테스트
 *
 * @description
 * AI 리포트 API의 전체 HTTP 요청/응답 플로우 테스트.
 * FakeAiProvider를 사용하여 실제 Gemini API 호출을 모킹합니다.
 *
 * ### 테스트 범위
 * - GET /ai/reports/status: 리포트 상태 조회
 * - GET /ai/reports: 리포트 목록 조회
 * - GET /ai/reports/:id: 리포트 상세 조회
 * - 인증 에러 (401)
 */
import { CacheService } from "#api/platform/cache/cache.service";
import { decodeRecord, encodePatch } from "#api/platform/database/database-records";
import { DatabaseService } from "#api/platform/database/database.service";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { createReportAiResponse } from "#test/fixtures/ai-response.fixture";

import { FakeAiProvider } from "../mocks/fake-ai.provider.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("AI 리포트 E2E", () => {
  let ctx: E2eTestContext;
  let fakeAiProvider: FakeAiProvider;

  beforeAll(async () => {
    fakeAiProvider = new FakeAiProvider();

    ctx = await createE2eApp({
      customizeBuilder: (builder) => builder.overrideProvider(AI_PROVIDER).useValue(fakeAiProvider),
      additionalResetters: [() => fakeAiProvider.clear()],
    });
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  /** 프리미엄 사용자를 생성하고 토큰을 반환하는 헬퍼 */
  async function createPremiumUser(email: string, password: string) {
    const user = await ctx.helpers.createVerifiedUser(email, password);
    const prisma = ctx.module.get(DatabaseService).db;
    decodeRecord(
      "User",
      requireRecord(
        await prisma.orm.public.User.where((row) => row.id.eq(user.userId)).update(
          encodePatch("User", { subscriptionStatus: "ACTIVE" }),
        ),
      ),
    );
    const cacheService = ctx.module.get(CacheService);
    await cacheService.del(EntitlementCacheKey.subscription(user.userId));
    return user;
  }

  describe("GET /ai/reports/status", () => {
    it("200: 다음 리포트 예정일을 포함한 상태를 반환해야 한다", async () => {
      // Given - 프리미엄 사용자
      const user = await createPremiumUser("ai-report-status@example.com", "Test1234!");

      // When - 리포트 상태 조회
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports/status")
        .set("Authorization", `Bearer ${user.accessToken}`)
        .set("X-Timezone", "Asia/Seoul");

      // Then - 200 응답과 상태 데이터 반환
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
      // Given - 인증 토큰 없음

      // When - 토큰 없이 상태 조회
      const response = await request(ctx.app.getHttpServer()).get("/v1/ai/reports/status");

      // Then - 401 Unauthorized 반환
      expect(response.status).toBe(401);
    });
  });

  describe("GET /ai/reports", () => {
    it("200: 빈 리포트 목록을 반환해야 한다 (초기 상태)", async () => {
      // Given - 프리미엄 사용자, 리포트가 없는 초기 상태
      const user = await createPremiumUser("ai-report-list@example.com", "Test1234!");

      // When - 리포트 목록 조회
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then - 200 응답과 빈 배열 반환
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reports).toEqual([]);
    });

    it("200: type 필터를 적용하여 조회할 수 있어야 한다", async () => {
      // Given - 프리미엄 사용자
      const user = await createPremiumUser("ai-report-filter@example.com", "Test1234!");

      // When - WEEKLY 타입으로 필터링
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports?type=WEEKLY&limit=5")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then - 200 응답 (빈 배열)
      expect(response.status).toBe(200);
      expect(response.body.data.reports).toEqual([]);
    });

    it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
      // Given - 인증 토큰 없음

      // When - 토큰 없이 목록 조회
      const response = await request(ctx.app.getHttpServer()).get("/v1/ai/reports");

      // Then - 401 Unauthorized 반환
      expect(response.status).toBe(401);
    });
  });

  describe("GET /ai/reports/:id", () => {
    it("404: 존재하지 않는 리포트 조회 시 에러를 반환해야 한다", async () => {
      // Given - 프리미엄 사용자, 존재하지 않는 리포트 ID
      const user = await createPremiumUser("ai-report-404@example.com", "Test1234!");

      // When - 없는 리포트 상세 조회
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports/99999")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then - 404 Not Found 반환
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("AI_1304");
    });

    it("401: 인증 없이 요청 시 에러를 반환해야 한다", async () => {
      // Given - 인증 토큰 없음

      // When - 토큰 없이 상세 조회
      const response = await request(ctx.app.getHttpServer()).get("/v1/ai/reports/1");

      // Then - 401 Unauthorized 반환
      expect(response.status).toBe(401);
    });

    it("400: 유효하지 않은 ID 형식 시 에러를 반환해야 한다", async () => {
      // Given - 프리미엄 사용자
      const user = await createPremiumUser("ai-report-invalid@example.com", "Test1234!");

      // When - 문자열 ID로 조회
      const response = await request(ctx.app.getHttpServer())
        .get("/v1/ai/reports/invalid")
        .set("Authorization", `Bearer ${user.accessToken}`);

      // Then - 400 Bad Request 반환
      expect(response.status).toBe(400);
    });
  });

  it.each(["ko", "en"] as const)(
    "%s 리포트는 실제 생성·저장 후 소유자 HTTP에 같은 문구로 전달된다",
    async (locale) => {
      // Given - 프리미엄 사용자와 완전 operation 응답
      const user = await createPremiumUser(`ai-report-${locale}@example.com`, "Test1234!");
      const raw = createReportAiResponse(locale);
      fakeAiProvider.setRawResponse(raw);
      // When - 실제 생성 UseCase·PG 후 조회 endpoint
      const report = await ctx.module
        .get(GenerateReport)
        .execute({ userId: user.userId, timezone: "Asia/Seoul", type: "WEEKLY", locale });
      expect(report).not.toBeNull();
      const response = await request(ctx.app.getHttpServer())
        .get(`/v1/ai/reports/${report!.id}`)
        .set("Authorization", `Bearer ${user.accessToken}`);
      // Then - schema 콘텐츠와 기간 read model을 보존
      expect(response.status).toBe(200);
      expect(response.body.data.report.aiSummary).toBe(raw.summary);
      expect(response.body.data.report.aiTips).toEqual(raw.tips);
      expect(response.body.data.report.periodLabel).toBe(report!.periodLabel);
      expect(fakeAiProvider.getCallCount()).toBe(1);
      const stored = decodeRecord(
        "AiReport",
        await ctx.testDatabase.getClient().orm.public.AiReport.where({ id: report!.id }).first(),
      );
      expect(stored?.locale).toBe(locale);
      const other = await createPremiumUser(`ai-report-other-${locale}@example.com`, "Test1234!");
      const denied = await request(ctx.app.getHttpServer())
        .get(`/v1/ai/reports/${report!.id}`)
        .set("Authorization", `Bearer ${other.accessToken}`);
      expect(denied.status).toBe(404);
      expect(denied.body.error.code).toBe("AI_1304");
    },
  );

  it("비프리미엄 리포트 조회는 없는 ID보다 AI_1308을 우선한다", async () => {
    // Given - FREE 사용자와 없는 리포트
    const user = await ctx.helpers.createVerifiedUser("ai-report-free@example.com", "Test1234!");
    // When - 상태·목록·상세 endpoints
    for (const route of ["/v1/ai/reports/status", "/v1/ai/reports", "/v1/ai/reports/999999"]) {
      const response = await request(ctx.app.getHttpServer())
        .get(route)
        .set("Authorization", `Bearer ${user.accessToken}`);
      // Then - 권한 우선, AI 호출 없음
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("AI_1308");
    }
    expect(fakeAiProvider.getCallCount()).toBe(0);
  });
});
