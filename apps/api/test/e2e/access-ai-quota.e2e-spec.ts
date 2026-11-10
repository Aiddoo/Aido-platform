import {
  entitlementSnapshotSchema,
  notChargedErrorDetailsSchema,
  parseTodoResponseSchema,
  quotaErrorDetailsSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import type {
  AiGenerationRequest,
  AiGenerationResult,
} from "#api/modules/ai-assistance/generation/application/ports/ai-generator.port";
import { requireRecord } from "#api/platform/database/database-error.util";
import { user as userTable } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { createAiGenerationError, FakeAiGenerator } from "#test/mocks/fake-ai.generator";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

const oldMonthAt = new Date("2026-04-30T14:59:59.000Z");
const newMonthAt = new Date("2026-04-30T15:00:01.000Z");
const nextResetAt = "2026-05-31T15:00:00.000Z";

class DeferredAiGenerator extends FakeAiGenerator {
  readonly #pending: Array<{
    entered: ReturnType<typeof Promise.withResolvers<void>>;
    continued: ReturnType<typeof Promise.withResolvers<void>>;
    error: Error | undefined;
  }> = [];

  deferNext(error?: Error) {
    const entered = Promise.withResolvers<void>();
    const continued = Promise.withResolvers<void>();
    this.#pending.push({ entered, continued, error });
    return { entered: entered.promise, release: () => continued.resolve() };
  }

  override async generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    const deferred = this.#pending.shift();
    const result = await super.generate(request);
    if (deferred === undefined) {
      return result;
    }
    deferred.entered.resolve();
    await deferred.continued.promise;
    if (deferred.error !== undefined) {
      throw deferred.error;
    }
    return result;
  }

  override clear(): this {
    for (const deferred of this.#pending) {
      deferred.continued.resolve();
    }
    this.#pending.length = 0;
    return super.clear();
  }
}

describe("Access AI quota HTTP 계약과 사용량 경쟁 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;
  let provider: DeferredAiGenerator;
  let user: { userId: string; accessToken: string };

  beforeAll(async () => {
    provider = new DeferredAiGenerator();
    context = await createE2eApp({
      customizeBuilder: (builder) => builder.overrideProvider(AiGeneratorPort).useValue(provider),
      additionalResetters: [() => provider.clear()],
    });
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(oldMonthAt);
    user = await context.helpers.createVerifiedUser("access-quota@example.com", "Test1234!");
    await setQuota({ count: 0, resetAt: oldMonthAt });
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function setQuota(input: {
    count: number;
    resetAt: Date;
    subscriptionStatus?: "FREE" | "ACTIVE";
    role?: "USER" | "ADMIN";
  }) {
    await context.testDatabase
      .getClient()
      .update(userTable)
      .set({
        aiUsageCount: input.count,
        aiUsageResetAt: instantFromDate(input.resetAt),
        subscriptionStatus: input.subscriptionStatus,
        role: input.role,
      })
      .where(eq(userTable.id, user.userId));
  }

  function parseTodo() {
    return request(context.app.getHttpServer())
      .post("/v1/ai/parse-todo")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send({ text: "오늘 오후 3시 회의" });
  }

  function readUsage() {
    return request(context.app.getHttpServer())
      .get("/v1/ai/usage")
      .set("Authorization", `Bearer ${user.accessToken}`);
  }

  async function storedQuota() {
    return requireRecord(
      await context.testDatabase.getClient().query.user.findFirst({
        columns: { aiUsageCount: true, aiUsageResetAt: true },
        where: { id: user.userId },
      }),
    );
  }

  it("무료 한도의 마지막 1회에 겹친 두 요청은 하나만 AI를 호출하고 다른 요청은 429로 거부한다", async () => {
    // Given
    await setQuota({ count: FREE_AI_LIMIT - 1, resetAt: oldMonthAt });
    const deferred = provider.deferNext();
    const requests = [parseTodo().then(), parseTodo().then()];
    let responses: Awaited<(typeof requests)[number]>[] = [];
    try {
      // When
      await Promise.race([
        deferred.entered,
        Promise.all(requests).then(() => {
          throw new Error("AI 응답을 대기하기 전에 두 HTTP 요청이 종료되었습니다.");
        }),
      ]);
      const denied = await Promise.race(requests);

      // Then
      expect(denied.status).toBe(429);
      expect(denied.body.error.code).toBe(ErrorCode.AI_1303);
    } finally {
      deferred.release();
      responses = await Promise.all(requests);
    }
    expect(responses.map((response) => response.status).sort()).toEqual([200, 429]);
    expect(provider.getCallCount()).toBe(1);
    expect((await storedQuota())?.aiUsageCount).toBe(FREE_AI_LIMIT);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({
      used: FREE_AI_LIMIT,
      limit: FREE_AI_LIMIT,
    });
  });

  it("한도 초과 429 응답은 차감하지 않았다는 표시와 서버가 계산한 featureQuota를 준다", async () => {
    // Given
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt });

    // When
    const response = await parseTodo();

    // Then
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe(ErrorCode.AI_1303);
    expect(quotaErrorDetailsSchema.parse(response.body.error.details)).toEqual({
      charged: false,
      featureQuota: {
        feature: "AI_PARSE",
        allowed: true,
        limit: FREE_AI_LIMIT,
        used: FREE_AI_LIMIT,
        remaining: 0,
        period: "month",
        resetsAt: "2026-04-30T15:00:00.000Z",
        isFairUse: false,
        perUse: null,
      },
    });
    expect(provider.getCallCount()).toBe(0);
  });

  it("성공 응답의 featureQuota는 이번 차감을 반영하고 GET /v1/entitlements와 같다", async () => {
    // Given
    await setQuota({ count: 2, resetAt: oldMonthAt });

    // When
    const response = await parseTodo().expect(200);
    const parsed = parseTodoResponseSchema.parse(response.body.data);
    const snapshot = await request(context.app.getHttpServer())
      .get("/v1/entitlements")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    // Then
    expect(parsed.featureQuota).toMatchObject({
      used: 3,
      remaining: FREE_AI_LIMIT - 3,
    });
    expect(entitlementSnapshotSchema.parse(snapshot.body.data).features.AI_PARSE).toEqual(
      parsed.featureQuota,
    );
    expect((await readUsage().expect(200)).body.data.data).toEqual({
      used: 3,
      limit: FREE_AI_LIMIT,
      resetsAt: "2026-04-30T15:00:00.000Z",
    });
  });

  it("AI 공급자 호출 실패는 기존 503 오류를 반환하고 예약한 사용량만 되돌린다", async () => {
    // Given
    await setQuota({ count: 2, resetAt: oldMonthAt });
    provider.setInvalidResponse(createAiGenerationError("UPSTREAM"));

    // When
    const response = await parseTodo();

    // Then
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(ErrorCode.AI_1301);
    expect(provider.getCallCount()).toBe(1);
    expect((await storedQuota())?.aiUsageCount).toBe(2);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({
      used: 2,
      limit: FREE_AI_LIMIT,
    });
  });

  it.each([
    { kind: "HALTED", status: 503, code: ErrorCode.AI_1301 },
    { kind: "USER_SPEND_LIMITED", status: 429, code: ErrorCode.AI_1310 },
  ] as const)(
    "킬 스위치·비용 예산으로 멈춘 생성($kind)은 $status $code와 차감 없음 상세를 주고 예약을 되돌린다",
    async ({ kind, status, code }) => {
      // Given
      await setQuota({ count: 2, resetAt: oldMonthAt });
      provider.setInvalidResponse(createAiGenerationError(kind));

      // When
      const response = await parseTodo();

      // Then
      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
      expect(notChargedErrorDetailsSchema.parse(response.body.error.details)).toEqual({
        charged: false,
      });
      expect((await storedQuota())?.aiUsageCount).toBe(2);
    },
  );

  it("KST 월초 조회는 지난달 사용량을 0으로 보여주고 다음 달 1일의 리셋 시각을 반환한다", async () => {
    // Given
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt });
    vi.setSystemTime(newMonthAt);

    // When
    const response = await readUsage();

    // Then
    expect(response.status).toBe(200);
    expect(response.body.data.data).toEqual({
      used: 0,
      limit: FREE_AI_LIMIT,
      resetsAt: nextResetAt,
    });
    expect((await storedQuota())?.aiUsageCount).toBe(FREE_AI_LIMIT);
    expect(provider.getCallCount()).toBe(0);
  });

  it("이전 달 AI 응답이 새달 성공 요청 뒤에 실패해도 새달 사용량을 차감하지 않는다", async () => {
    // Given
    const deferred = provider.deferNext(createAiGenerationError("UPSTREAM"));
    const previousRequest = parseTodo().then();
    try {
      await Promise.race([
        deferred.entered,
        previousRequest.then(() => {
          throw new Error("이전 달 AI 요청이 응답 대기에 도달하지 않았습니다.");
        }),
      ]);
      expect((await storedQuota())?.aiUsageCount).toBe(1);
      vi.setSystemTime(newMonthAt);
      const currentResponse = await parseTodo();
      expect(currentResponse.status).toBe(200);
      expect((await storedQuota())?.aiUsageCount).toBe(1);

      // When
      deferred.release();
      const previousResponse = await previousRequest;

      // Then
      expect(previousResponse.status).toBe(503);
      expect(previousResponse.body.error.code).toBe(ErrorCode.AI_1301);
      expect((await readUsage().expect(200)).body.data.data).toEqual({
        used: 1,
        limit: FREE_AI_LIMIT,
        resetsAt: nextResetAt,
      });
      expect(await storedQuota()).toMatchObject({
        aiUsageCount: 1,
        aiUsageResetAt: instantFromDate(newMonthAt),
      });
      expect(provider.getCallCount()).toBe(2);
    } finally {
      deferred.release();
      await previousRequest;
    }
  });

  it("FREE 권한 캐시가 남아도 DB의 ACTIVE 구독은 무료 한도 이상을 사용할 수 있다", async () => {
    // Given
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt });
    const entitlement = context.module.get(EntitlementReaderPort);
    expect(await entitlement.getFeatureLimit(user.userId, "AI_PARSE")).toBe(FREE_AI_LIMIT);
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt, subscriptionStatus: "ACTIVE" });

    // When
    const response = await parseTodo();

    // Then
    expect(response.status).toBe(200);
    expect(provider.getCallCount()).toBe(1);
    expect((await storedQuota())?.aiUsageCount).toBe(FREE_AI_LIMIT + 1);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({
      used: FREE_AI_LIMIT + 1,
      limit: null,
    });
    expect(await entitlement.getFeatureLimit(user.userId, "AI_PARSE")).toBe(FREE_AI_LIMIT);
  });

  it("ACTIVE 권한 캐시가 남아도 DB에서 FREE가 된 사용자는 소진한 무료 한도를 넘을 수 없다", async () => {
    // Given
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt, subscriptionStatus: "ACTIVE" });
    const entitlement = context.module.get(EntitlementReaderPort);
    expect(await entitlement.getFeatureLimit(user.userId, "AI_PARSE")).toBeNull();
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt, subscriptionStatus: "FREE" });

    // When
    const response = await parseTodo();

    // Then
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe(ErrorCode.AI_1303);
    expect(provider.getCallCount()).toBe(0);
    expect((await storedQuota())?.aiUsageCount).toBe(FREE_AI_LIMIT);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({
      used: FREE_AI_LIMIT,
      limit: FREE_AI_LIMIT,
    });
    expect(await entitlement.getFeatureLimit(user.userId, "AI_PARSE")).toBeNull();
  });

  it("ADMIN은 프리미엄과 같은 AI 공정 사용 상한에서 같은 429 상세로 막히고 KST 다음 달에 다시 쓴다", async () => {
    // Given
    const fairUse = PLAN_CATALOG.AI_PARSE.fairUse.premium;
    await setQuota({ count: fairUse, resetAt: oldMonthAt, subscriptionStatus: "ACTIVE" });
    const premium = await parseTodo();
    await setQuota({
      count: fairUse,
      resetAt: oldMonthAt,
      subscriptionStatus: "FREE",
      role: "ADMIN",
    });

    // When
    const admin = await parseTodo();
    vi.setSystemTime(newMonthAt);
    const nextMonth = await parseTodo();

    // Then
    expect([premium.status, admin.status]).toEqual([429, 429]);
    expect(admin.body.error.code).toBe(ErrorCode.AI_1303);
    expect(admin.body.error.details).toEqual(premium.body.error.details);
    expect(quotaErrorDetailsSchema.parse(admin.body.error.details).featureQuota).toEqual({
      feature: "AI_PARSE",
      allowed: true,
      limit: fairUse,
      used: fairUse,
      remaining: 0,
      period: "month",
      resetsAt: "2026-04-30T15:00:00.000Z",
      isFairUse: true,
      perUse: null,
    });
    expect(nextMonth.status).toBe(200);
    expect(provider.getCallCount()).toBe(1);
    expect((await storedQuota())?.aiUsageCount).toBe(1);
  });

  it("USER→ADMIN으로 역할을 바꾸면 원장은 캐시와 무관하게 바로 프리미엄 상한으로 판단한다", async () => {
    // Given
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt });
    const entitlement = context.module.get(EntitlementReaderPort);
    expect(await entitlement.getFeatureLimit(user.userId, "AI_PARSE")).toBe(FREE_AI_LIMIT);
    await setQuota({ count: FREE_AI_LIMIT, resetAt: oldMonthAt, role: "ADMIN" });

    // When
    const response = await parseTodo();

    // Then
    expect(response.status).toBe(200);
    expect(response.body.data.featureQuota).toMatchObject({
      limit: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      used: FREE_AI_LIMIT + 1,
      isFairUse: true,
    });
  });
});
