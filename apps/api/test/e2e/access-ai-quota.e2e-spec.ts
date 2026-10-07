import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
  Feature,
} from "#api/modules/access/access-entitlement.public";
import { AI_PROVIDER } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import {
  AiProviderCallError,
  type GenerateStructuredOptions,
  type GenerateStructuredResult,
} from "#api/modules/ai-assistance/application/ports/parsing/ai-provider.port";
import { decodeRecord, encodePatch } from "#api/platform/database/database-records";
import { FakeAiProvider } from "#test/mocks/fake-ai.provider";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const oldMonthAt = new Date("2026-04-30T14:59:59.000Z");
const newMonthAt = new Date("2026-04-30T15:00:01.000Z");
const nextResetAt = "2026-05-31T15:00:00.000Z";

class DeferredAiProvider extends FakeAiProvider {
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

  override async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const deferred = this.#pending.shift();
    const result = await super.generateStructured(options);
    if (deferred === undefined) return result;
    deferred.entered.resolve();
    await deferred.continued.promise;
    if (deferred.error !== undefined) throw deferred.error;
    return result;
  }

  override clear(): this {
    for (const deferred of this.#pending) deferred.continued.resolve();
    this.#pending.length = 0;
    return super.clear();
  }
}

describe("Access AI quota HTTP 계약과 사용량 경쟁 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;
  let provider: DeferredAiProvider;
  let user: { userId: string; accessToken: string };

  beforeAll(async () => {
    provider = new DeferredAiProvider();
    context = await createE2eApp({
      customizeBuilder: (builder) => builder.overrideProvider(AI_PROVIDER).useValue(provider),
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
  }) {
    await context.testDatabase
      .getClient()
      .orm.public.User.where({ id: user.userId })
      .update(
        encodePatch("User", {
          aiUsageCount: input.count,
          aiUsageResetAt: input.resetAt,
          subscriptionStatus: input.subscriptionStatus,
        }),
      );
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
    return decodeRecord(
      "User",
      await context.testDatabase
        .getClient()
        .orm.public.User.where({ id: user.userId })
        .select("aiUsageCount", "aiUsageResetAt")
        .first(),
    );
  }

  it("무료 한도의 마지막 1회에 겹친 두 요청은 하나만 AI를 호출하고 다른 요청은 429로 거부한다", async () => {
    // Given
    await setQuota({ count: 4, resetAt: oldMonthAt });
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
    expect((await storedQuota())?.aiUsageCount).toBe(5);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({ used: 5, limit: 5 });
  });

  it("AI 공급자 호출 실패는 기존 503 오류를 반환하고 예약한 사용량만 되돌린다", async () => {
    // Given
    await setQuota({ count: 2, resetAt: oldMonthAt });
    provider.setInvalidResponse(new AiProviderCallError("공급자 연결 실패", 503));
    // When
    const response = await parseTodo();
    // Then
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(ErrorCode.AI_1301);
    expect(provider.getCallCount()).toBe(1);
    expect((await storedQuota())?.aiUsageCount).toBe(2);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({ used: 2, limit: 5 });
  });

  it("KST 월초 조회는 지난달 사용량을 0으로 보여주고 다음 달 1일의 리셋 시각을 반환한다", async () => {
    // Given
    await setQuota({ count: 5, resetAt: oldMonthAt });
    vi.setSystemTime(newMonthAt);
    // When
    const response = await readUsage();
    // Then
    expect(response.status).toBe(200);
    expect(response.body.data.data).toEqual({ used: 0, limit: 5, resetsAt: nextResetAt });
    expect((await storedQuota())?.aiUsageCount).toBe(5);
    expect(provider.getCallCount()).toBe(0);
  });

  it("이전 달 AI 응답이 새달 성공 요청 뒤에 실패해도 새달 사용량을 차감하지 않는다", async () => {
    // Given
    const deferred = provider.deferNext(new AiProviderCallError("이전 달 공급자 요청 실패", 503));
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
        limit: 5,
        resetsAt: nextResetAt,
      });
      expect(await storedQuota()).toMatchObject({
        aiUsageCount: 1,
        aiUsageResetAt: newMonthAt,
      });
      expect(provider.getCallCount()).toBe(2);
    } finally {
      deferred.release();
      await previousRequest;
    }
  });

  it("FREE 권한 캐시가 남아도 DB의 ACTIVE 구독은 무료 한도 이상을 사용할 수 있다", async () => {
    // Given
    await setQuota({ count: 5, resetAt: oldMonthAt });
    const entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
    expect((await entitlement.getFeatureLimit(user.userId, Feature.AI_PARSE)).dailyLimit).toBe(5);
    await setQuota({ count: 5, resetAt: oldMonthAt, subscriptionStatus: "ACTIVE" });
    // When
    const response = await parseTodo();
    // Then
    expect(response.status).toBe(200);
    expect(provider.getCallCount()).toBe(1);
    expect((await storedQuota())?.aiUsageCount).toBe(6);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({ used: 6, limit: null });
    expect((await entitlement.getFeatureLimit(user.userId, Feature.AI_PARSE)).dailyLimit).toBe(5);
  });

  it("ACTIVE 권한 캐시가 남아도 DB에서 FREE가 된 사용자는 소진한 무료 한도를 넘을 수 없다", async () => {
    // Given
    await setQuota({ count: 5, resetAt: oldMonthAt, subscriptionStatus: "ACTIVE" });
    const entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
    expect(
      (await entitlement.getFeatureLimit(user.userId, Feature.AI_PARSE)).dailyLimit,
    ).toBeNull();
    await setQuota({ count: 5, resetAt: oldMonthAt, subscriptionStatus: "FREE" });
    // When
    const response = await parseTodo();
    // Then
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe(ErrorCode.AI_1303);
    expect(provider.getCallCount()).toBe(0);
    expect((await storedQuota())?.aiUsageCount).toBe(5);
    expect((await readUsage().expect(200)).body.data.data).toMatchObject({ used: 5, limit: 5 });
    expect(
      (await entitlement.getFeatureLimit(user.userId, Feature.AI_PARSE)).dailyLimit,
    ).toBeNull();
  });
});
