import { memoDetailResponseSchema } from "@aido/api/contracts/memo/v1";
import {
  applyActionPlanResponseSchema,
  quickPlanResponseSchema,
} from "@aido/api/contracts/voice/v1";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AiGeneratorPort } from "#api/modules/ai-assistance/ai-generations/ai-assistance-ai-generations.public";
import { user } from "#api/platform/database/schema/index";
import {
  createAiGenerationError,
  FakeAiGenerator,
} from "#test/doubles/ai-assistance/fake-ai.generator";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { memoActionDraft, todoActionDraft } from "#test/fixtures/voice/voice-plan.fixture";

describe("빠른 계획·계획 적용 E2E", () => {
  let testContext: E2eTestContext;
  let aiGenerator: FakeAiGenerator;
  let keySequence = 0;

  beforeAll(async () => {
    aiGenerator = new FakeAiGenerator();
    testContext = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(AiGeneratorPort).useValue(aiGenerator),
      additionalResetters: [() => aiGenerator.clear()],
    });
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  function nextKey() {
    keySequence += 1;
    return `e2e-key-${keySequence}`;
  }

  function post(path: string, accessToken: string, body: object, key: string | null = nextKey()) {
    const pending = request(testContext.app.getHttpServer())
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

  async function createUser(email: string, values: Partial<typeof user.$inferInsert> = {}) {
    const created = await testContext.helpers.createVerifiedUser(email, "Test1234!");
    if (Object.keys(values).length > 0) {
      await testContext.testDatabase
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
    const categoryId = await testContext.helpers.getDefaultCategoryId(accessToken);
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
    const usage = await request(testContext.app.getHttpServer())
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

  describe("등급 표", () => {
    it.each([
      { tier: "FREE", values: {}, limit: PLAN_CATALOG.AI_PARSE.free },
      {
        tier: "PREMIUM",
        values: { subscriptionStatus: "ACTIVE" },
        limit: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      },
      {
        tier: "ADMIN",
        values: { role: "ADMIN" },
        limit: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      },
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
      const categoryId = await testContext.helpers.getDefaultCategoryId(accessToken);
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
      const afterApply = await request(testContext.app.getHttpServer())
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
      const categoryId = await testContext.helpers.getDefaultCategoryId(accessToken);
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
