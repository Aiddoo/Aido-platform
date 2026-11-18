import { voiceNoteDigestResponseSchema } from "@aido/api/contracts/voice/v1";
import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { AiGeneratorPort } from "#api/modules/ai-assistance/ai-generations/ai-assistance-ai-generations.public";
import { VoiceDigestRateLimits } from "#api/modules/voice/voice-digests/presentation/http/voice-digests.rate-limits";
import { user } from "#api/platform/database/schema/index";
import { FakeAiGenerator } from "#test/doubles/ai-assistance/fake-ai.generator";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { digestDraft } from "#test/fixtures/voice/voice-plan.fixture";

const { maxCharacters } = PLAN_CATALOG.VOICE_NOTE.perUse;

describe("녹음 정리 E2E", () => {
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

  function digestBody(text = "회의를 했습니다. 회의록은 제가 보냅니다.") {
    return {
      text,
      durationSeconds: 60,
      segments: [
        { startMs: 0, text: "회의를 했습니다.", isBookmarked: false },
        { startMs: 4200, text: "회의록은 제가 보냅니다.", isBookmarked: true },
      ],
    };
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

  it("요약·핵심 내용·계획을 공유 응답 스키마로 주고 시각은 앱이 보낸 값이다", async () => {
    // Given
    const { accessToken } = await createUser("voice-digest@test.com");
    aiGenerator.setRawResponse(digestDraft());

    // When
    const response = await post("/v1/voice-notes/digest", accessToken, digestBody()).expect(200);

    // Then
    const parsed = voiceNoteDigestResponseSchema.parse(response.body.data);
    expect(response.body.data).not.toHaveProperty("meta");
    expect(parsed.keyPoints[0]?.startMs).toBe(4200);
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
    {
      tier: "ADMIN",
      values: { role: "ADMIN" },
      limit: PLAN_CATALOG.VOICE_NOTE.fairUse.premium,
    },
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
    const entitlements = await request(testContext.app.getHttpServer())
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
    expect(rejected.body.error.code).toBe(ErrorCode.SYS_0002);
    expect(aiGenerator.getCallCount()).toBe(1);
  });
});

describe("녹음 정리 요청 제한 E2E (실제 throttler, 직렬 실행)", () => {
  let testContext: E2eTestContext;
  let aiGenerator: FakeAiGenerator;

  beforeAll(async () => {
    aiGenerator = new FakeAiGenerator();
    testContext = await createE2eApp({
      withRealThrottler: true,
      customizeBuilder: (builder) =>
        builder.overrideProvider(AiGeneratorPort).useValue(aiGenerator),
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  it("분당 한도를 넘으면 429이고 하루 한도는 녹음 정리에만 센다", async () => {
    // Given
    const { accessToken } = await testContext.helpers.createVerifiedUser(
      "voice-throttle@test.com",
      "Test1234!",
    );
    const digest = (index: number) =>
      request(testContext.app.getHttpServer())
        .post("/v1/voice-notes/digest")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", `throttle-${index}`)
        .send({ text: "x".repeat(maxCharacters.free + 1), durationSeconds: 1, segments: [] });
    const allowed = [];
    for (let index = 0; index < VoiceDigestRateLimits.digest.limitPerMinute; index += 1) {
      allowed.push(await digest(index));
    }

    // When
    const throttled = await digest(99);
    const quick = await request(testContext.app.getHttpServer())
      .post("/v1/quick-plans")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ text: "", source: "TEXT" });

    // Then
    expect(allowed.map((response) => response.status)).toEqual(allowed.map(() => 422));
    expect(allowed[0]?.headers["x-ratelimit-limit-daily"]).toBe(
      String(VoiceDigestRateLimits.digest.limitPerDay),
    );
    expect(throttled.status).toBe(429);
    expect(quick.headers["x-ratelimit-limit-daily"]).toBeUndefined();
  });
});
