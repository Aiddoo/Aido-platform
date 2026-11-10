import {
  applyActionPlanResponseSchema,
  memoDetailResponseSchema,
  quickPlanResponseSchema,
  voiceNoteDigestResponseSchema,
} from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AiGeneratorPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { VOICE_NOTE_THROTTLE } from "#api/modules/voice/voice-notes/presentation/http/v1/voice-note.controller";
import { user } from "#api/platform/database/schema/index";
import { digestDraft, memoActionDraft, todoActionDraft } from "#test/fixtures/voice-plan.fixture";
import { createAiGenerationError, FakeAiGenerator } from "#test/mocks/fake-ai.generator";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "../helpers/index.js";

const { maxCharacters } = PLAN_CATALOG.VOICE_NOTE.perUse;

describe("빠른 계획·녹음 정리·계획 적용 E2E", () => {
  let ctx: E2eTestContext;
  let aiGenerator: FakeAiGenerator;
  let keySequence = 0;

  beforeAll(async () => {
    aiGenerator = new FakeAiGenerator();
    ctx = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(AiGeneratorPort).useValue(aiGenerator),
      additionalResetters: [() => aiGenerator.clear()],
    });
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  function nextKey() {
    keySequence += 1;
    return `e2e-key-${keySequence}`;
  }

  function post(path: string, accessToken: string, body: object, key: string | null = nextKey()) {
    const pending = request(ctx.app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .set("Accept-Language", "ko");
    return (key == null ? pending : pending.set("Idempotency-Key", key)).send(body);
  }

  function quickPlan(accessToken: string, key?: string | null) {
    return post(
      "/v1/quick-plans",
      accessToken,
      { text: "내일 회의록 보내기", source: "VOICE" },
      key,
    );
  }

  function digestBody(text = "회의를 했습니다. 회의록은 제가 보냅니다.") {
    return {
      text,
      durationSeconds: 60,
      segments: [
        { startMs: 0, text: "회의를 했습니다.", isBookmarked: false },
        { startMs: 4_200, text: "회의록은 제가 보냅니다.", isBookmarked: true },
      ],
    };
  }

  async function createUser(email: string, values: Partial<typeof user.$inferInsert> = {}) {
    const created = await ctx.helpers.createVerifiedUser(email, "Test1234!");
    if (Object.keys(values).length > 0) {
      await ctx.testDatabase
        .getClient()
        .update(user)
        .set(values)
        .where(eq(user.id, created.userId));
    }
    return created;
  }

  it("빠른 계획을 받아 카테고리를 채워 적용하면 할 일과 메모가 저장되고 횟수는 한 번만 쓴다", async () => {
    // Given
    const { accessToken } = await createUser("voice-flow@test.com");
    const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
    aiGenerator.setRawResponse({
      todos: [todoActionDraft({ time: { hour: 15, minute: 0, meridiem: "NONE" } })],
      memo: memoActionDraft(),
    });
    // When
    const planned = await quickPlan(accessToken).expect(200);
    const parsed = quickPlanResponseSchema.parse(planned.body.data);
    expect(planned.body.data).not.toHaveProperty("meta");
    const actions = parsed.plan.actions.map((action) =>
      action.type === "CREATE_TODO" ? { ...action, categoryId } : action,
    );
    const applied = await post("/v1/action-plans/apply", accessToken, {
      source: "QUICK_VOICE",
      actions,
    }).expect(200);
    // Then
    const result = applyActionPlanResponseSchema.parse(applied.body.data);
    expect(parsed.charged).toBe(true);
    expect(parsed.featureQuota).toMatchObject({ feature: "AI_PARSE", used: 1 });
    expect(result.todos[0]).toMatchObject({ title: "회의록 보내기", isAllDay: false });
    expect(result.memo?.content).toContain("온보딩 문구");
    const usage = await request(ctx.app.getHttpServer())
      .get("/v1/ai/usage")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(usage.body.data.data.used).toBe(1);
  });

  it("Idempotency-Key가 없거나 형식이 틀리면 처리 전에 AI_1316이다", async () => {
    // Given
    const { accessToken } = await createUser("voice-key@test.com");
    // When
    const missing = await quickPlan(accessToken, null).expect(400);
    const invalid = await quickPlan(accessToken, "a b").expect(400);
    // Then
    expect(missing.body.error.code).toBe(ErrorCode.AI_1316);
    expect(invalid.body.error.code).toBe(ErrorCode.AI_1316);
    expect(aiGenerator.getCallCount()).toBe(0);
  });

  it("같은 키의 재요청은 같은 계획을 주고 한 번만 차감하며 다른 내용은 AI_1318이다", async () => {
    // Given
    const { accessToken } = await createUser("voice-replay@test.com");
    aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
    const first = await quickPlan(accessToken, "same-key").expect(200);
    // When
    const second = await quickPlan(accessToken, "same-key").expect(200);
    const reused = await post(
      "/v1/quick-plans",
      accessToken,
      { text: "다른 내용", source: "TEXT" },
      "same-key",
    ).expect(422);
    // Then
    expect(second.body.data.plan).toEqual(first.body.data.plan);
    expect(second.body.data.featureQuota.used).toBe(1);
    expect(aiGenerator.getCallCount()).toBe(1);
    expect(reused.body.error.code).toBe(ErrorCode.AI_1318);
  });

  it("AI 실패는 503 AI_1301에 charged:false를 싣고 차감하지 않는다", async () => {
    // Given
    const { accessToken } = await createUser("voice-fail@test.com");
    aiGenerator.setInvalidResponse(createAiGenerationError("TIMEOUT"));
    // When
    const response = await quickPlan(accessToken).expect(503);
    // Then
    expect(response.body.error.code).toBe(ErrorCode.AI_1301);
    expect(response.body.error.details).toEqual({ charged: false });
  });

  it("1.15 앱이 AI 처리에 동의하지 않았으면 AI_1311이고 AI를 부르지 않는다", async () => {
    // Given
    const { accessToken } = await createUser("voice-consent@test.com");
    // When
    const response = await quickPlan(accessToken).set("X-App-Version", "1.15.0").expect(403);
    // Then
    expect(response.body.error.code).toBe(ErrorCode.AI_1311);
    expect(aiGenerator.getCallCount()).toBe(0);
  });

  describe("녹음 정리", () => {
    it("요약·핵심 내용·계획을 공유 응답 스키마로 주고 시각은 앱이 보낸 값이다", async () => {
      // Given
      const { accessToken } = await createUser("voice-digest@test.com");
      aiGenerator.setRawResponse(digestDraft());
      // When
      const response = await post("/v1/voice-notes/digest", accessToken, digestBody()).expect(200);
      // Then
      const parsed = voiceNoteDigestResponseSchema.parse(response.body.data);
      expect(response.body.data).not.toHaveProperty("meta");
      expect(parsed.keyPoints[0]?.startMs).toBe(4_200);
      expect(parsed.featureQuota).toMatchObject({
        feature: "VOICE_NOTE",
        used: 1,
        limit: PLAN_CATALOG.VOICE_NOTE.free,
      });
      expect(parsed.charged).toBe(true);
    });

    it.each([
      { tier: "FREE", values: {}, limit: PLAN_CATALOG.VOICE_NOTE.free },
      {
        tier: "PREMIUM",
        values: { subscriptionStatus: "ACTIVE" },
        limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
      },
      { tier: "ADMIN", values: { role: "ADMIN" }, limit: null },
    ] as const)(
      "$tier은 할 일 없는 정리도 1회를 쓰고 같은 키의 재요청은 같은 결과에 한 번만 센다",
      async ({ tier, values, limit }) => {
        // Given
        const { accessToken } = await createUser(
          `voice-summary-${tier.toLowerCase()}@test.com`,
          values,
        );
        aiGenerator.setRawResponse(digestDraft({ todos: [] }));
        const key = nextKey();
        // When
        const first = await post("/v1/voice-notes/digest", accessToken, digestBody(), key).expect(
          200,
        );
        const second = await post("/v1/voice-notes/digest", accessToken, digestBody(), key).expect(
          200,
        );
        // Then
        const parsedFirst = voiceNoteDigestResponseSchema.parse(first.body.data);
        const parsedSecond = voiceNoteDigestResponseSchema.parse(second.body.data);
        expect(second.body.data).not.toHaveProperty("meta");
        expect(parsedFirst.plan.actions).toEqual([]);
        expect([parsedFirst.charged, parsedSecond.charged]).toEqual([true, true]);
        expect(parsedSecond.summary).toBe(parsedFirst.summary);
        expect(parsedFirst.featureQuota).toMatchObject({ limit, used: 1 });
        expect(parsedSecond.featureQuota).toMatchObject({ limit, used: 1 });
        expect(aiGenerator.getCallCount()).toBe(1);
      },
    );

    it("돌려줄 내용이 전혀 없으면 422 AI_1302에 charged:false를 싣고 차감하지 않는다", async () => {
      // Given
      const { accessToken } = await createUser("voice-empty@test.com");
      aiGenerator.setRawResponse(digestDraft({ title: "", summary: "", keyPoints: [], todos: [] }));
      // When
      const response = await post("/v1/voice-notes/digest", accessToken, digestBody()).expect(422);
      const entitlements = await request(ctx.app.getHttpServer())
        .get("/v1/entitlements")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      // Then
      expect(response.body.error.code).toBe(ErrorCode.AI_1302);
      expect(response.body.error.details).toEqual({ charged: false });
      expect(entitlements.body.data.features.VOICE_NOTE.used).toBe(0);
    });

    it.each([
      { tier: "FREE", values: {}, maxLength: maxCharacters.free },
      {
        tier: "PREMIUM",
        values: { subscriptionStatus: "ACTIVE" },
        maxLength: maxCharacters.premium,
      },
      { tier: "ADMIN", values: { role: "ADMIN" }, maxLength: maxCharacters.premium },
    ] as const)(
      "$tier은 $maxLength자를 넘으면 422 AI_1312다",
      async ({ tier, values, maxLength }) => {
        // Given
        const { accessToken } = await createUser(
          `voice-limit-${tier.toLowerCase()}@test.com`,
          values,
        );
        const body = { text: "a".repeat(maxLength + 1), durationSeconds: 60, segments: [] };
        // When
        const response = await post("/v1/voice-notes/digest", accessToken, body).expect(422);
        // Then
        expect(response.body.error.code).toBe(ErrorCode.AI_1312);
        expect(response.body.error.details).toMatchObject({
          charged: false,
          characterCount: maxLength + 1,
          maxCharacters: maxLength,
        });
        expect(aiGenerator.getCallCount()).toBe(0);
      },
    );

    it("무료 월 한도를 다 쓰면 429 AI_1313에 현재 한도를 싣는다", async () => {
      // Given
      const { accessToken } = await createUser("voice-quota@test.com");
      for (let index = 0; index < PLAN_CATALOG.VOICE_NOTE.free; index += 1) {
        aiGenerator.setRawResponse(digestDraft());
        await post("/v1/voice-notes/digest", accessToken, digestBody()).expect(200);
      }
      // When
      const response = await post("/v1/voice-notes/digest", accessToken, digestBody()).expect(429);
      // Then
      expect(response.body.error.code).toBe(ErrorCode.AI_1313);
      expect(response.body.error.details).toMatchObject({
        charged: false,
        featureQuota: { used: PLAN_CATALOG.VOICE_NOTE.free, remaining: 0 },
      });
    });

    it("256KB를 넘는 본문은 413이고 기본 한도 100KB를 넘는 본문은 받는다", async () => {
      // Given
      const { accessToken } = await createUser("voice-body@test.com", {
        subscriptionStatus: "ACTIVE",
      });
      aiGenerator.setRawResponse(digestDraft());
      const within = { text: "가".repeat(39_000), durationSeconds: 60, segments: [] };
      const tooLarge = { text: "a".repeat(257 * 1024), durationSeconds: 60, segments: [] };
      // When
      const accepted = await post("/v1/voice-notes/digest", accessToken, within);
      const rejected = await post("/v1/voice-notes/digest", accessToken, tooLarge);
      // Then
      expect(accepted.status).toBe(200);
      expect(rejected.status).toBe(413);
      expect(aiGenerator.getCallCount()).toBe(1);
    });
  });

  describe("등급 표", () => {
    it.each([
      { tier: "FREE", values: {}, limit: PLAN_CATALOG.AI_PARSE.free },
      {
        tier: "PREMIUM",
        values: { subscriptionStatus: "ACTIVE" },
        limit: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      },
      { tier: "ADMIN", values: { role: "ADMIN" }, limit: null },
    ] as const)(
      "$tier의 빠른 계획 한도는 $limit이고 사용량을 기록한다",
      async ({ tier, values, limit }) => {
        // Given
        const { accessToken } = await createUser(
          `voice-tier-${tier.toLowerCase()}@test.com`,
          values,
        );
        aiGenerator.setRawResponse({ todos: [todoActionDraft()], memo: null });
        // When
        const response = await quickPlan(accessToken).expect(200);
        // Then
        const { featureQuota } = quickPlanResponseSchema.parse(response.body.data);
        expect(featureQuota).toMatchObject({ limit, used: 1 });
      },
    );
  });

  describe("적용 검증", () => {
    it("메모에서 만든 계획을 저장하면 원본 메모가 지워지고 sourceMemoId 없이는 400이다", async () => {
      // Given
      const { accessToken } = await createUser("voice-memo@test.com");
      const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
      const created = await post("/v1/memos", accessToken, { content: "원본 메모" }).expect(201);
      const memoId = memoDetailResponseSchema.parse(created.body.data).memo.id;
      const action = {
        type: "CREATE_TODO",
        key: "todo-0",
        title: "회의록",
        categoryId,
        startDate: "2027-01-04",
        endDate: null,
        scheduledTime: null,
        repeat: null,
        visibility: null,
        items: [],
      };
      // When
      const missing = await post("/v1/action-plans/apply", accessToken, {
        source: "MEMO",
        actions: [action],
      });
      const applied = await post("/v1/action-plans/apply", accessToken, {
        source: "MEMO",
        sourceMemoId: memoId,
        actions: [action],
      });
      const afterApply = await request(ctx.app.getHttpServer())
        .get(`/v1/memos/${memoId}`)
        .set("Authorization", `Bearer ${accessToken}`);
      // Then
      expect(missing.status).toBe(400);
      expect(applied.status).toBe(200);
      expect(afterApply.status).toBe(404);
    });

    it("카테고리가 없는 할 일은 400이고 내 카테고리가 아니면 422 AI_1315다", async () => {
      // Given
      const { accessToken } = await createUser("voice-apply@test.com");
      const categoryId = await ctx.helpers.getDefaultCategoryId(accessToken);
      const action = {
        type: "CREATE_TODO",
        key: "todo-0",
        title: "회의록",
        startDate: "2027-01-04",
        endDate: null,
        scheduledTime: null,
        repeat: null,
        visibility: null,
        items: [],
      };
      // When
      const withoutCategory = await post("/v1/action-plans/apply", accessToken, {
        source: "VOICE_NOTE",
        actions: [{ ...action, categoryId: null }],
      });
      const notOwned = await post("/v1/action-plans/apply", accessToken, {
        source: "VOICE_NOTE",
        actions: [{ ...action, categoryId: categoryId + 1000 }],
      });
      // Then
      expect(withoutCategory.status).toBe(400);
      expect(notOwned.status).toBe(422);
      expect(notOwned.body.error.code).toBe(ErrorCode.AI_1315);
      expect(notOwned.body.error.details).toEqual({
        reason: "CATEGORY_NOT_OWNED",
        categoryIds: [categoryId + 1000],
      });
    });
  });
});

describe("녹음 정리 요청 제한 E2E (실제 throttler, 직렬 실행)", () => {
  let ctx: E2eTestContext;
  let aiGenerator: FakeAiGenerator;

  beforeAll(async () => {
    aiGenerator = new FakeAiGenerator();
    ctx = await createE2eApp({
      withRealThrottler: true,
      customizeBuilder: (builder) =>
        builder.overrideProvider(AiGeneratorPort).useValue(aiGenerator),
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it("분당 한도를 넘으면 429이고 하루 한도는 녹음 정리에만 센다", async () => {
    // Given
    const { accessToken } = await ctx.helpers.createVerifiedUser(
      "voice-throttle@test.com",
      "Test1234!",
    );
    const digest = (index: number) =>
      request(ctx.app.getHttpServer())
        .post("/v1/voice-notes/digest")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", `throttle-${index}`)
        .send({ text: "x".repeat(maxCharacters.free + 1), durationSeconds: 1, segments: [] });
    const allowed = [];
    for (let index = 0; index < VOICE_NOTE_THROTTLE.MINUTE.default.limit; index += 1) {
      allowed.push(await digest(index));
    }
    // When
    const throttled = await digest(99);
    const quick = await request(ctx.app.getHttpServer())
      .post("/v1/quick-plans")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ text: "", source: "TEXT" });
    // Then
    expect(allowed.map((response) => response.status)).toEqual(allowed.map(() => 422));
    expect(allowed[0]?.headers["x-ratelimit-limit-daily"]).toBe(
      String(VOICE_NOTE_THROTTLE.DAY_LIMIT),
    );
    expect(throttled.status).toBe(429);
    expect(quick.headers["x-ratelimit-limit-daily"]).toBeUndefined();
  });
});
