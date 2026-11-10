import { notChargedErrorDetailsSchema, parseTodoResponseSchema } from "@aido/api";
import { ErrorCode, Errors } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";
import { assert } from "vitest";

import { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";
import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
/**
 * AI 모듈 E2E 테스트
 *
 * @description
 * AI 자연어 투두 파싱 API의 전체 플로우 테스트.
 * FakeAiGenerator를 사용하여 실제 Gemini API 호출을 모킹합니다.
 *
 * ### 테스트 범위
 * - POST /ai/parse-todo: 자연어 파싱
 * - GET /ai/usage: 사용량 조회
 * - 월간 사용량 제한 (PLAN_CATALOG.AI_PARSE, KST 매월 1일 00:00 리셋)
 * - 에러 처리 (400, 401, 422, 429, 503)
 */
import { user } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import {
  createMemoDraftResponse,
  createTodoDraftResponse,
  parsingIntentCases,
} from "#test/fixtures/ai-response.fixture";

import { FakeAiGenerator } from "../mocks/fake-ai.generator.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

/** 연도까지 말한 날짜 표현. 서버가 계산한 날짜가 실행 시각과 무관하게 정해진다. */
function onDate(year: number, month: number, day: number) {
  return { kind: "CALENDAR_DATE", year, month, day } as const;
}

/** 오전·오후 없이 24시간제로 말한 시각 표현 */
function at(hour: number, minute = 0) {
  return { hour, minute, meridiem: "NONE" } as const;
}

/** parse-memo 모델 출력의 할 일 하나 */
function memoTodo(title: string, overrides: Record<string, unknown> = {}) {
  return {
    ...createTodoDraftResponse({ title }),
    categoryId: 999_999,
    items: [],
    ...overrides,
  };
}

describe("AI E2E", () => {
  let ctx: E2eTestContext;
  let fakeAiGenerator: FakeAiGenerator;
  let accessToken: string;
  let testUserId: string;

  const testUser = {
    email: "ai-test@example.com",
    password: "Test1234!",
  };

  /**
   * 사용량 리셋 헬퍼
   */
  async function resetUsage(userId: string): Promise<void> {
    const db = ctx.testDatabase.getClient();
    await db
      .update(user)
      .set({
        aiUsageCount: 0,
        aiUsageResetAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      })
      .where(eq(user.id, userId));
  }

  /**
   * 사용량 설정 헬퍼
   */
  async function setUsage(userId: string, count: number): Promise<void> {
    const db = ctx.testDatabase.getClient();
    await db
      .update(user)
      .set({
        aiUsageCount: count,
        aiUsageResetAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      })
      .where(eq(user.id, userId));
  }

  /**
   * 사용량 + 리셋 시각 명시 설정 헬퍼 (월 경계 테스트용)
   */
  async function setUsageWithResetAt(userId: string, count: number, resetAt: Date): Promise<void> {
    const db = ctx.testDatabase.getClient();
    await db
      .update(user)
      .set({
        aiUsageCount: count,
        aiUsageResetAt: instantFromDate(resetAt),
      })
      .where(eq(user.id, userId));
  }

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

    const user = await ctx.helpers.createVerifiedUser(testUser.email, testUser.password);
    accessToken = user.accessToken;
    testUserId = user.userId;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST /ai/parse-todo", () => {
    describe("성공 케이스", () => {
      it("인증된 사용자가 자연어를 성공적으로 파싱", async () => {
        // Given
        // 서버는 지난 날짜를 다음 시기로 옮기므로 가짜 응답 날짜보다 앞선 시각으로 고정한다
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2025-01-25T03:00:00Z"));
        fakeAiGenerator.setResponse({
          title: "팀 미팅",
          date: onDate(2_025, 1, 26),
          time: at(15),
        });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "내일 오후 3시에 팀 미팅" });

        // Then
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.success).toBe(true);
        expect(response.body.data.data).toMatchObject({
          title: "팀 미팅",
          startDate: "2025-01-26",
          scheduledTime: "15:00",
          isAllDay: false,
        });

        expect(response.body.data.meta).toMatchObject({
          model: "fake:test-model",
        });
        expect(response.body.data.meta.processingTimeMs).toBeGreaterThanOrEqual(0);
        expect(response.body.data.meta.tokenUsage).toEqual({
          input: 150,
          output: 50,
        });

        expect(fakeAiGenerator.getCallCount()).toBe(1);
      });

      it("확정 뒤 한도를 읽지 못해도 파싱 결과를 주고 featureQuota만 뺀다", async () => {
        // Given
        fakeAiGenerator.setResponse({ title: "회의", date: onDate(2_025, 1, 26) });
        // 남은 횟수 선검사(@RequireQuota)는 원장 read를 거치지 않아 확정 뒤 읽기만 실패시킨다
        const ledger = ctx.module.get(QuotaLedgerPort);
        vi.spyOn(ledger, "read").mockRejectedValueOnce(new TypeError("db down"));

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "내일 회의" });

        // Then
        expect(response.status).toBe(200);
        expect(parseTodoResponseSchema.parse(response.body.data).data.title).toBeDefined();
        expect(response.body.data).not.toHaveProperty("featureQuota");
      });

      it("categoryId가 포함된 요청 시 응답에 categoryId가 반환됨", async () => {
        // Given
        fakeAiGenerator.setResponse({
          title: "팀 미팅",
          date: onDate(2_025, 1, 26),
          time: at(15),
        });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "내일 오후 3시에 팀 미팅", categoryId: 5 });

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.data.categoryId).toBe(5);
      });

      it("categoryId 없이 요청 시 응답에 categoryId가 없음", async () => {
        // Given
        fakeAiGenerator.setResponse({
          title: "팀 미팅",
          date: onDate(2_025, 1, 26),
          time: at(15),
        });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "내일 오후 3시에 팀 미팅" });

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.data).not.toHaveProperty("categoryId");
      });

      it("종일 일정을 올바르게 파싱", async () => {
        // Given
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2025-01-25T03:00:00Z"));
        fakeAiGenerator.setResponse({
          title: "출장",
          date: onDate(2_025, 1, 27),
          endDate: onDate(2_025, 1, 31),
          time: null,
        });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "다음주 월요일부터 금요일까지 출장" });

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.data.isAllDay).toBe(true);
        expect(response.body.data.data.endDate).toBe("2025-01-31");
        expect(response.body.data.data.scheduledTime).toBeNull();
      });

      it("연속 요청 시 사용량이 증가", async () => {
        // Given
        fakeAiGenerator.setDefaultResponse({
          title: "테스트",
          date: onDate(2_025, 1, 26),
        });

        // When
        for (let i = 0; i < 3; i++) {
          await request(ctx.app.getHttpServer())
            .post("/v1/ai/parse-todo")
            .set("Authorization", `Bearer ${accessToken}`)
            .set("X-Timezone", "Asia/Seoul")
            .send({ text: `테스트 ${i + 1}` })
            .expect(200);
        }

        // Then
        const usageResponse = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200);

        expect(usageResponse.body.data.data.used).toBe(3);
        expect(usageResponse.body.data.data.limit).toBe(FREE_AI_LIMIT);
        expect(fakeAiGenerator.getCallCount()).toBe(3);
      });

      it("허용되지 않은 필드는 무시되고 정상 처리", async () => {
        // Given
        fakeAiGenerator.setResponse({
          title: "테스트",
          date: onDate(2_025, 1, 25),
          time: null,
        });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "테스트", unknownField: "value" })
          .expect(200);

        // Then
        expect(response.body.data.data.title).toBe("테스트");
        expect(fakeAiGenerator.getCallCount()).toBe(1);
      });

      it("다양한 한국어 자연어 입력을 파싱", async () => {
        // Given
        const testCases = [
          {
            input: "아침 9시에 운동",
            draft: { title: "운동", time: { hour: 9, minute: 0, meridiem: "AM" } },
            expected: { title: "운동", scheduledTime: "09:00" },
          },
          {
            input: "저녁에 친구 만남",
            draft: { title: "친구 만남", time: { partOfDay: "EVENING" } },
            expected: { title: "친구 만남", scheduledTime: "19:00" },
          },
          {
            input: "모레 점심 약속",
            draft: {
              title: "점심 약속",
              date: { kind: "OFFSET_DAYS", amount: 2 },
              time: { partOfDay: "NOON" },
            },
            expected: { title: "점심 약속", scheduledTime: "12:00" },
          },
        ] as const;

        for (const testCase of testCases) {
          fakeAiGenerator.setResponse(testCase.draft);

          // When
          const response = await request(ctx.app.getHttpServer())
            .post("/v1/ai/parse-todo")
            .set("Authorization", `Bearer ${accessToken}`)
            .set("X-Timezone", "Asia/Seoul")
            .send({ text: testCase.input });

          // Then
          expect(response.status).toBe(200);
          expect(response.body.data.data.title).toBe(testCase.expected.title);
          expect(response.body.data.data.scheduledTime).toBe(testCase.expected.scheduledTime);
        }

        expect(fakeAiGenerator.getCallCount()).toBe(3);
      });
    });

    describe("사용량 제한", () => {
      it("무료 한도를 넘으면 429 에러 반환 (AI_1303)", async () => {
        // Given
        await setUsage(testUserId, FREE_AI_LIMIT);

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "테스트" });

        // Then
        expect(response.status).toBe(429);
        expect(response.body.error.code).toBe("AI_1303");
        expect(response.body.error.message).toBe(Errors[ErrorCode.AI_1303].message);

        expect(fakeAiGenerator.getCallCount()).toBe(0);
      });

      it("지난 달 resetsAt을 가진 사용자는 이번 달 첫 요청 시 사용량이 1로 리셋된다", async () => {
        // Given
        fakeAiGenerator.setDefaultResponse({
          title: "테스트",
          date: onDate(2_026, 5, 1),
        });
        const now = new Date();
        const previousMonthFirstDay = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
        );
        await setUsageWithResetAt(testUserId, FREE_AI_LIMIT, previousMonthFirstDay);

        // When
        const parseResponse = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "테스트" });

        // Then
        expect(parseResponse.status).toBe(200);

        const usageResponse = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200);

        expect(usageResponse.body.data.data.used).toBe(1);
        expect(usageResponse.body.data.data.limit).toBe(FREE_AI_LIMIT);
      });

      it("resetsAt 필드는 KST 매월 1일 00:00 의 UTC 시각을 반환한다", async () => {
        // Given
        await setUsage(testUserId, 2);

        // When
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200);

        // Then
        const resetsAt = new Date(response.body.data.data.resetsAt);
        expect(resetsAt.getUTCHours()).toBe(15);
        expect(resetsAt.getUTCMinutes()).toBe(0);
        expect(resetsAt.getUTCSeconds()).toBe(0);
        const kstDate = new Date(resetsAt.getTime() + 9 * 60 * 60 * 1_000);
        expect(kstDate.getUTCDate()).toBe(1);
      });

      it("무료 한도까지는 성공하고 그다음 요청은 429 에러", async () => {
        // Given
        fakeAiGenerator.setDefaultResponse({
          title: "테스트",
          date: onDate(2_025, 1, 26),
        });

        // When
        for (let i = 0; i < FREE_AI_LIMIT; i++) {
          await request(ctx.app.getHttpServer())
            .post("/v1/ai/parse-todo")
            .set("Authorization", `Bearer ${accessToken}`)
            .set("X-Timezone", "Asia/Seoul")
            .send({ text: `테스트 ${i + 1}` })
            .expect(200);
        }

        // Then
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "한도 초과" });

        expect(response.status).toBe(429);
        expect(response.body.error.code).toBe("AI_1303");
        expect(fakeAiGenerator.getCallCount()).toBe(FREE_AI_LIMIT);
      });
    });

    describe("인증 에러", () => {
      it("인증 토큰 없이 요청 시 401 에러", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .send({ text: "내일 회의" });

        // Then
        expect(response.status).toBe(401);
        expect(fakeAiGenerator.getCallCount()).toBe(0);
      });

      it("유효하지 않은 토큰으로 요청 시 401 에러", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", "Bearer invalid-token")
          .send({ text: "내일 회의" });

        // Then
        expect(response.status).toBe(401);
        expect(fakeAiGenerator.getCallCount()).toBe(0);
      });
    });

    describe("유효성 검증 에러", () => {
      it("빈 텍스트 요청 시 400 에러", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ text: "" });

        // Then
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(fakeAiGenerator.getCallCount()).toBe(0);
      });

      it("text 필드 누락 시 400 에러", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({});

        // Then
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(fakeAiGenerator.getCallCount()).toBe(0);
      });

      it("500자 초과 텍스트 요청 시 400 에러", async () => {
        // Given
        const longText = "가".repeat(501);

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ text: longText });

        // Then
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(fakeAiGenerator.getCallCount()).toBe(0);
      });
    });

    describe("AI 서비스 에러", () => {
      it("보낼 수 있는 AI 업체가 없으면 503 AI_1301과 차감 없음 상세를 준다", async () => {
        // Given
        fakeAiGenerator.setAvailable(false);

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "내일 회의" });

        // Then
        expect(response.status).toBe(503);
        expect(response.body.error.code).toBe("AI_1301");
        expect(notChargedErrorDetailsSchema.parse(response.body.error.details)).toEqual({
          charged: false,
        });
      });

      it("환불이 저장되지 않으면 같은 코드만 주고 차감 없음 상세를 싣지 않는다", async () => {
        // Given
        fakeAiGenerator.setAvailable(false);
        const ledger = ctx.module.get(QuotaLedgerPort);
        vi.spyOn(ledger, "refund").mockResolvedValueOnce(false);

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "내일 회의" });

        // Then
        expect(response.status).toBe(503);
        expect(response.body.error.code).toBe("AI_1301");
        expect(response.body.error.details).toBeUndefined();
      });

      it("할 일을 만들지 못하면 422 AI_1302와 차감 없음 상세를 준다", async () => {
        // Given
        fakeAiGenerator.setInvalidResponse(new Error("파싱 실패"));

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "알 수 없는 입력" });

        // Then
        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe("AI_1302");
        expect(notChargedErrorDetailsSchema.parse(response.body.error.details)).toEqual({
          charged: false,
        });
      });
    });

    describe("토큰 사용량 추적", () => {
      it("응답에 토큰 사용량이 포함됨", async () => {
        // Given
        fakeAiGenerator.setTokenUsage({ input: 200, output: 80 });
        fakeAiGenerator.setResponse({
          title: "테스트",
          date: onDate(2_025, 1, 26),
        });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: "테스트" });

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.meta.tokenUsage).toEqual({
          input: 200,
          output: 80,
        });
      });
    });
  });

  describe("GET /ai/usage", () => {
    describe("성공 케이스", () => {
      it("사용량이 0인 경우", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`);

        // Then
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.success).toBe(true);
        expect(response.body.data.data).toMatchObject({
          used: 0,
          limit: FREE_AI_LIMIT,
        });
        expect(response.body.data.data.resetsAt).toBeDefined();
      });

      it("사용량이 있는 경우", async () => {
        // Given
        await setUsage(testUserId, 3);

        // When
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`);

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.data).toMatchObject({
          used: 3,
          limit: FREE_AI_LIMIT,
        });
      });

      it("사용량이 최대인 경우", async () => {
        // Given
        await setUsage(testUserId, FREE_AI_LIMIT);

        // When
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`);

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.data).toMatchObject({
          used: FREE_AI_LIMIT,
          limit: FREE_AI_LIMIT,
        });
      });

      it("리셋 시간이 ISO 8601 형식임", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`);

        // Then
        expect(response.status).toBe(200);
        const resetsAt = response.body.data.data.resetsAt;
        expect(resetsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

        const resetDate = new Date(resetsAt);
        expect(resetDate.getTime()).toBeGreaterThan(Date.now());
      });
    });

    describe("인증 에러", () => {
      it("인증 토큰 없이 요청 시 401 에러", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer()).get("/v1/ai/usage");

        // Then
        expect(response.status).toBe(401);
      });

      it("유효하지 않은 토큰으로 요청 시 401 에러", async () => {
        // Given

        // When
        const response = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", "Bearer invalid-token");

        // Then
        expect(response.status).toBe(401);
      });
    });
  });

  describe("타임존 처리", () => {
    it("X-Timezone 헤더가 프롬프트에 반영된다", async () => {
      // Given
      fakeAiGenerator.setResponse({
        title: "테스트",
        date: onDate(2_025, 1, 26),
      });

      // When
      await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-todo")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ text: "테스트" })
        .expect(200);

      // Then
      const prompt = fakeAiGenerator.getLastPrompt();
      expect(prompt).toContain("테스트");
      expect(prompt).toContain('"timezone": "Asia/Seoul"');
      expect(fakeAiGenerator.getLastSystem()).not.toContain("Asia/Seoul");
    });

    it("X-Timezone 헤더 없이도 정상 동작한다 (UTC 폴백)", async () => {
      // Given
      fakeAiGenerator.setResponse({
        title: "테스트",
        date: onDate(2_025, 1, 26),
      });

      // When
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-todo")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ text: "테스트" });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.data.title).toBe("테스트");
    });
  });

  describe("통합 시나리오", () => {
    it("파싱 요청 후 사용량이 정확히 반영됨", async () => {
      // Given
      fakeAiGenerator.setDefaultResponse({
        title: "테스트",
        date: onDate(2_025, 1, 26),
      });

      // When
      const initialUsage = await request(ctx.app.getHttpServer())
        .get("/v1/ai/usage")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // Then
      expect(initialUsage.body.data.data.used).toBe(0);

      // When
      await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-todo")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ text: "테스트 1" })
        .expect(200);

      await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-todo")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ text: "테스트 2" })
        .expect(200);

      // Then
      const finalUsage = await request(ctx.app.getHttpServer())
        .get("/v1/ai/usage")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(finalUsage.body.data.data.used).toBe(2);
    });

    it("사용량 제한 후 리셋되면 다시 사용 가능", async () => {
      // Given
      fakeAiGenerator.setDefaultResponse({
        title: "테스트",
        date: onDate(2_025, 1, 26),
      });
      await setUsage(testUserId, FREE_AI_LIMIT);

      // When
      const failedResponse = await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-todo")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ text: "테스트" });

      // Then
      expect(failedResponse.status).toBe(429);

      // When
      await resetUsage(testUserId);
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-todo")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-Timezone", "Asia/Seoul")
        .send({ text: "테스트" });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.data.title).toBe("테스트");
    });
  });

  describe("POST /ai/parse-memo", () => {
    describe("성공 케이스", () => {
      it("메모를 다중 Todo+SubTodo로 파싱", async () => {
        // Given
        fakeAiGenerator.setRawResponse({
          todos: [
            memoTodo("버그 수정", {
              date: onDate(2_026, 4, 12),
              time: at(14),
              items: [{ title: "로그 확인" }],
            }),
            memoTodo("자료 올리기", { date: onDate(2_026, 4, 11) }),
          ],
        });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-memo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ content: "내일 2시 버그 수정, 자료 올리기", categoryId: 1 });

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.data.todos).toHaveLength(2);
        expect(response.body.data.data.todos[0]).toMatchObject({
          title: "버그 수정",
          scheduledTime: "14:00",
          categoryId: 1,
        });
        expect(response.body.data.data.todos[0].items).toHaveLength(1);
        expect(response.body.data.data.todos[1]).toMatchObject({
          title: "자료 올리기",
          isAllDay: true,
          categoryId: 1,
        });
      });

      it("소유하지 않은 추론 categoryId는 요청 categoryId로 대체한다", async () => {
        // Given
        fakeAiGenerator.setRawResponse({ todos: [memoTodo("할 일")] });

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-memo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ content: "할 일", categoryId: 42 });

        // Then
        expect(response.status).toBe(200);
        expect(response.body.data.data.todos[0].categoryId).toBe(42);
      });

      it("파싱 후 사용량이 1 증가", async () => {
        // Given
        fakeAiGenerator.setRawResponse({ todos: [memoTodo("테스트")] });
        await resetUsage(testUserId);

        // When
        await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-memo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ content: "테스트", categoryId: 1 });

        const usageResponse = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`);

        // Then
        expect(usageResponse.body.data.data.used).toBe(1);
      });
    });

    describe("에러 케이스", () => {
      it("인증 없이 요청 시 401", async () => {
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-memo")
          .send({ content: "테스트", categoryId: 1 });

        expect(response.status).toBe(401);
      });

      it("빈 content 시 400", async () => {
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-memo")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ content: "", categoryId: 1 });

        expect(response.status).toBe(400);
      });

      it("categoryId 누락 시 400", async () => {
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-memo")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ content: "테스트" });

        expect(response.status).toBe(400);
      });

      it("사용량 초과 시 429", async () => {
        // Given
        await setUsage(testUserId, FREE_AI_LIMIT);

        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-memo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("X-Timezone", "Asia/Seoul")
          .send({ content: "테스트", categoryId: 1 });

        // Then
        expect(response.status).toBe(429);
        expect(response.body.error.code).toBe("AI_1303");
      });
    });
  });

  it.each([5, 6])(
    "메모 하위 항목 %i개는 합치지 않고 앞의 5개만 두며 사용량 한 회를 쓴다",
    async (itemCount) => {
      // Given
      const memo = createMemoDraftResponse();
      const [firstTodo] = memo.todos;
      assert.exists(firstTodo);
      firstTodo.items = Array.from({ length: itemCount }, (_, index) => ({
        title: `발표 준비 단계 ${index + 1}`,
      }));
      fakeAiGenerator.setRawResponse(memo);

      // When
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-memo")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "발표 준비", categoryId: 1 });
      const usage = await request(ctx.app.getHttpServer())
        .get("/v1/ai/usage")
        .set("Authorization", `Bearer ${accessToken}`);

      // Then
      expect(response.status).toBe(200);
      expect(usage.status).toBe(200);
      expect(usage.body.data.data.used).toBe(1);
      expect(fakeAiGenerator.getCallCount()).toBe(1);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.data.todos[0].items).toEqual(firstTodo.items.slice(0, 5));
    },
  );

  it.each(["ko", "en"] as const)(
    "%s parsing은 locale prompt를 선택하고 요청당 quota 한 회만 쓴다",
    async (locale) => {
      // Given
      const title = locale === "ko" ? "책 읽기" : "Read a book";
      fakeAiGenerator.setResponse({ title });

      // When
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-todo")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Accept-Language", locale)
        .send({ text: title });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.data.title).toBe(title);
      expect(fakeAiGenerator.getLastSystem()).toContain(locale === "en" ? "You are" : "너는");
      const usage = await request(ctx.app.getHttpServer())
        .get("/v1/ai/usage")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(usage.body.data.data.used).toBe(1);
    },
  );

  it.each(["ko", "en"] as const)(
    "%s Memo의 다중 결과도 실제 quota는 한 회만 증가한다",
    async (locale) => {
      // Given
      const raw = createMemoDraftResponse(1);
      const [firstTodo] = raw.todos;
      assert.exists(firstTodo);
      raw.todos.push({
        ...firstTodo,
        title: locale === "en" ? "Prepare notes" : "자료 준비",
        items: [],
      });
      fakeAiGenerator.setRawResponse(raw);

      // When
      const response = await request(ctx.app.getHttpServer())
        .post("/v1/ai/parse-memo")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Accept-Language", locale)
        .send({ content: "일정 두 개", categoryId: 1 });

      // Then
      expect(response.status).toBe(200);
      expect(response.body.data.data.todos).toHaveLength(2);
      expect(fakeAiGenerator.getCallCount()).toBe(1);
      const usage = await request(ctx.app.getHttpServer())
        .get("/v1/ai/usage")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(usage.body.data.data.used).toBe(1);
    },
  );

  it.each([
    { locale: "ko", route: "parse-todo" },
    { locale: "en", route: "parse-todo" },
    { locale: "ko", route: "parse-memo" },
    { locale: "en", route: "parse-memo" },
  ] as const)(
    "$locale $route는 혼합 지시 원문을 보존하고 납부 정답 fixture를 HTTP로 반환한다",
    async ({ locale, route }) => {
      // Given
      const item = parsingIntentCases.find((candidate) => candidate.id === "mixed-command");
      if (!item) {
        throw new Error("혼합 지시 회귀 fixture가 필요합니다");
      }
      const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
      const draft = createTodoDraftResponse({
        title: item.title[locale],
        date: { kind: "OFFSET_DAYS", amount: 1 },
        time: { hour: 9, minute: 0, meridiem: "AM" },
      });
      if (route === "parse-todo") {
        fakeAiGenerator.setResponse(draft);
      } else {
        fakeAiGenerator.setRawResponse({ todos: [{ ...draft, categoryId: 999_999, items: [] }] });
      }
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-07T14:30:00Z"));
      try {
        // When
        const response = await request(ctx.app.getHttpServer())
          .post(`/v1/ai/${route}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .set("Accept-Language", locale)
          .set("X-Timezone", "Asia/Seoul")
          .send(
            route === "parse-todo"
              ? { text: item.input[locale], categoryId }
              : { content: item.input[locale], categoryId },
          );

        // Then
        expect(response.status).toBe(200);
        const data = response.body.data.data;
        const parsed = route === "parse-todo" ? data : data.todos[0];
        expect(parsed).toMatchObject({
          title: item.title[locale],
          startDate: "2026-03-08",
          scheduledTime: "09:00",
          isAllDay: false,
          categoryId,
        });
        if (route === "parse-memo") {
          expect(data.todos).toHaveLength(1);
          expect(parsed.items).toEqual([]);
        }
        expect(fakeAiGenerator.getLastPrompt()).toContain(JSON.stringify(item.input[locale]));
        expect(fakeAiGenerator.getLastSystem()).toContain(JSON.stringify(item.title[locale]));
        expect(fakeAiGenerator.getLastSystem()).toContain(
          '"time":{"hour":9,"minute":0,"meridiem":"AM","partOfDay":null,"relativeMinutes":null}',
        );
        const usage = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`);
        expect(usage.body.data.data.used).toBe(1);
        expect(fakeAiGenerator.getCallCount()).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each([
    { input: "매일 러닝", title: "러닝" },
    { input: "매일 러닝 30분", title: "러닝 30분" },
  ])(
    "$input의 원문과 반환 분량을 보존하고 매일 반복·시간 null·quota 한 회를 유지한다",
    async ({ input, title }) => {
      // Given
      const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
      const dailyDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
      fakeAiGenerator.setResponse({ title, repeat: { pattern: "DAILY" } });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-07T14:30:00Z"));
      try {
        // When
        const response = await request(ctx.app.getHttpServer())
          .post("/v1/ai/parse-todo")
          .set("Authorization", `Bearer ${accessToken}`)
          .set("Accept-Language", "ko")
          .set("X-Timezone", "Asia/Seoul")
          .send({ text: input, categoryId })
          .expect(200);

        // Then
        expect(response.body.data.data).toMatchObject({
          title,
          scheduledTime: null,
          isAllDay: true,
          isRecurring: true,
          recurrence: { daysOfWeek: dailyDays, endDate: "2026-04-04" },
          categoryId,
        });
        expect(fakeAiGenerator.getLastPrompt()).toContain(JSON.stringify(input));
        const usage = await request(ctx.app.getHttpServer())
          .get("/v1/ai/usage")
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200);
        expect(usage.body.data.data.used).toBe(1);
        expect(fakeAiGenerator.getCallCount()).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["parse-todo", "parse-memo"])(
    "%s의 필수 필드 누락 raw 출력은 실제 AI_1302와 quota 보상을 반환한다",
    async (route) => {
      // Given
      fakeAiGenerator.setRawResponse({});

      // When
      const response = await request(ctx.app.getHttpServer())
        .post(`/v1/ai/${route}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(route === "parse-todo" ? { text: "회의" } : { content: "회의", categoryId: 1 });

      // Then
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("AI_1302");
      expect(fakeAiGenerator.getCallCount()).toBe(1);
      const usage = await request(ctx.app.getHttpServer())
        .get("/v1/ai/usage")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(usage.body.data.data.used).toBe(0);
    },
  );
});
