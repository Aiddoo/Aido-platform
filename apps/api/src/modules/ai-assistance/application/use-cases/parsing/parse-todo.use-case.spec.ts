import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { createAiParsingFixture } from "#test/fixtures/ai-parsing.fixture";
import { TEST_AI_TASK_SETTINGS_V1 } from "#test/fixtures/ai-task-settings.fixture";
import { QUOTA_LEDGER_TIME } from "#test/fixtures/quota-ledger.fixture";
import { createAiGenerationError } from "#test/mocks/fake-ai.generator";

import { ParseTodo, type ParseTodoInput } from "./parse-todo.use-case.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

function createFixture() {
  const fixture = createAiParsingFixture();
  fixture.generator.setDefaultResponse({
    title: "팀 미팅",
    startDate: "2026-04-12",
    categoryId: 7,
  });
  const useCase = new ParseTodo({ ...fixture, settings: TEST_AI_TASK_SETTINGS_V1 });
  const input: ParseTodoInput = {
    userId: fixture.userId,
    text: "내일 팀 미팅",
    timezone: "Asia/Seoul",
    categoryId: undefined,
    locale: "ko",
  };
  return { ...fixture, useCase, input };
}

describe("ParseTodo — v1 롤백 경로", () => {
  it("필수 필드가 없는 실제 raw 응답은 AI_1302로 거절하고 quota를 보상한다", async () => {
    // Given - 정상 fixture 기본 응답과 별개인 원본 빈 객체
    const fixture = createFixture();
    fixture.generator.setRawResponse({});
    // When - 실제 parsing schema 검증
    const execution = fixture.useCase.execute(fixture.input);
    // Then - 누락 필드를 채우지 않으며 사용량 원복
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1302" });
    expect((await fixture.quota.read(fixture.userId, "AI_PARSE")).used).toBe(0);
    expect(fixture.generator.getCallCount()).toBe(1);
  });

  it("Fake clear는 이전 테스트의 default와 raw queue·실패·usage 설정을 모두 초기화한다", async () => {
    // Given - 모든 mutable 응답 설정이 이전 실행에서 바뀜
    const fixture = createFixture();
    fixture.generator
      .setRawResponse({})
      .setAvailable(false)
      .setInvalidResponse()
      .setTokenUsage({ input: 1 })
      .setDelay(1);
    // When - fixture reuse 전 clear
    fixture.generator.clear();
    const result = await fixture.useCase.execute(fixture.input);
    // Then - constructor의 완전 정상 응답과 기본 usage 복원
    expect(result.data.title).toBe("테스트 할 일");
    expect(result.meta.tokenUsage).toEqual({ input: 150, output: 50 });
    expect(fixture.generator.getCallCount()).toBe(1);
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(QUOTA_LEDGER_TIME);
  });
  afterEach(() => {
    try {
      vi.restoreAllMocks();
    } finally {
      vi.useRealTimers();
    }
  });

  it("성공한 요청은 사용량 한 회를 유지하고 데이터와 모델 정보를 반환한다", async () => {
    // Given
    const fixture = createFixture();
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(await fixture.quota.read(fixture.userId, "AI_PARSE")).toMatchObject({
      used: 1,
      limit: FREE_AI_LIMIT,
    });
    expect(result.featureQuota).toMatchObject({
      feature: "AI_PARSE",
      used: 1,
      remaining: FREE_AI_LIMIT - 1,
    });
    expect([...fixture.repository.charges.values()]).toMatchObject([
      { status: "COMMITTED", reason: "parse-todo", idempotencyKey: null },
    ]);
    expect(result.data).toMatchObject({ title: "팀 미팅", categoryId: 7 });
    expect(result.meta).toMatchObject({
      model: "fake:test-model",
      processingTimeMs: 0,
      tokenUsage: { input: 150, output: 50 },
    });
  });

  it("보낼 수 있는 AI 업체가 없으면 예약을 환불하고 차감 없음과 함께 AI_1301을 반환한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setAvailable(false);
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({
      errorCode: "AI_1301",
      details: { charged: false },
    });
    expect((await fixture.quota.read(fixture.userId, "AI_PARSE")).used).toBe(0);
  });

  it("한도가 소진된 요청은 provider를 호출하지 않고 AI_1303을 반환한다", async () => {
    // Given
    const fixture = createFixture();
    for (let index = 0; index < FREE_AI_LIMIT; index += 1) {
      await fixture.quota.reserve({
        userId: fixture.userId,
        feature: "AI_PARSE",
        idempotencyKey: null,
        reason: "parse-todo",
      });
    }
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1303" });
    expect(fixture.generator.getCallCount()).toBe(0);
  });

  it("소유하지 않은 추론 카테고리는 응답에서 제외한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setResponse({ categoryId: 999 });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.categoryId).toBeUndefined();
  });

  it("명시한 카테고리는 추론된 카테고리보다 우선한다", async () => {
    // Given
    const fixture = createFixture();
    // When
    const result = await fixture.useCase.execute({ ...fixture.input, categoryId: 3 });
    // Then
    expect(result.data.categoryId).toBe(3);
  });

  it.each([
    { error: createAiGenerationError("RATE_LIMITED"), errorCode: "AI_1310" },
    { error: createAiGenerationError("UPSTREAM"), errorCode: "AI_1301" },
    { error: createAiGenerationError("TIMEOUT"), errorCode: "AI_1301" },
    { error: createAiGenerationError("UNAVAILABLE"), errorCode: "AI_1301" },
    { error: createAiGenerationError("TRUNCATED"), errorCode: "AI_1302" },
    { error: createAiGenerationError("BLOCKED"), errorCode: "AI_1302" },
    { error: createAiGenerationError("INVALID_OUTPUT"), errorCode: "AI_1302" },
    { error: new Error("invalid output"), errorCode: "AI_1302" },
  ])(
    "공급자 오류 $error.message는 $errorCode를 반환하고 예약 사용량을 보상한다",
    async ({ error, errorCode }) => {
      // Given
      const fixture = createFixture();
      fixture.generator.setInvalidResponse(error);
      // When
      const execution = fixture.useCase.execute(fixture.input);
      // Then
      await expect(execution).rejects.toMatchObject({ errorCode });
      expect((await fixture.quota.read(fixture.userId, "AI_PARSE")).used).toBe(0);
      expect([...fixture.repository.charges.values()]).toMatchObject([
        { status: "REFUNDED", refundReason: "FAILED" },
      ]);
    },
  );

  it("카테고리 조회 실패는 원래 오류를 유지하며 예약 사용량을 보상한다", async () => {
    // Given
    const fixture = createFixture();
    const failure = new Error("category unavailable");
    vi.spyOn(fixture.categoryReader, "findByUserId").mockRejectedValueOnce(failure);
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toBe(failure);
    expect((await fixture.quota.read(fixture.userId, "AI_PARSE")).used).toBe(0);
    expect(fixture.generator.getCallCount()).toBe(0);
  });

  it("동의한 안내 버전과 프롬프트 버전을 생성기에 넘기고 원문 없이 업체·비용과 생성 결과를 기록한다", async () => {
    // Given - 출시 앱(1.13·1.14)에서 이전 안내에 동의한 사용자
    const fixture = createFixture();
    fixture.consentReader.decision = "AGREED";
    fixture.consentReader.agreedVersion = "2026-10-26";
    fixture.generator.setTokenUsage({ reasoning: 12 });
    // When
    await fixture.useCase.execute({ ...fixture.input, text: "PRIVATE_TODO_TEXT" });
    // Then
    expect(fixture.generator.getLastRequest()).toMatchObject({
      task: "parse-todo",
      promptVersion: "parse-todo@v1",
      agreedConsentVersion: "2026-10-26",
    });
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: "ai.generation.completed",
      task: "parse-todo",
      promptVersion: "parse-todo@v1",
      provider: "google",
      model: "fake:test-model",
      attempts: 1,
      fallbackFrom: null,
      estimatedCostMicroUsd: 0,
      latencyMs: 0,
      inputTokens: 150,
      outputTokens: 50,
      reasoningTokens: 12,
      finishReason: "stop",
      outcome: "SUCCESS",
      quotaCharged: true,
      userId: fixture.userId,
      warnings: [],
    });
    expect(JSON.stringify(fixture.logger.log.mock.calls)).not.toContain("PRIVATE_TODO_TEXT");
  });

  it("동의 화면이 없던 앱처럼 동의 버전이 없으면 동의 버전 없이 생성기에 넘긴다", async () => {
    // Given
    const fixture = createFixture();
    fixture.consentReader.decision = "UNDECIDED";
    // When
    await fixture.useCase.execute(fixture.input);
    // Then
    expect(fixture.generator.getLastRequest()).toMatchObject({ agreedConsentVersion: null });
  });

  it("카테고리를 고른 요청은 카테고리 목록을 읽거나 프롬프트에 넣지 않는다", async () => {
    // Given
    const fixture = createFixture();
    const read = vi.spyOn(fixture.categoryReader, "findByUserId");
    // When
    const result = await fixture.useCase.execute({ ...fixture.input, categoryId: 3 });
    // Then
    expect(read).not.toHaveBeenCalled();
    expect(fixture.generator.getLastPrompt()).not.toContain("업무");
    expect(result.data.categoryId).toBe(3);
  });

  it("X-Timezone이 없으면 저장된 사용자 시간대로 프롬프트를 만든다", async () => {
    // Given
    const fixture = createFixture();
    fixture.localePreferenceReader.preferences.set(fixture.userId, {
      timezone: "Asia/Seoul",
      locale: "ko",
    });
    // When
    await fixture.useCase.execute({ ...fixture.input, timezone: undefined });
    // Then
    expect(fixture.generator.getLastPrompt()).toContain("Asia/Seoul");
    expect(fixture.localePreferenceReader.readCount).toBe(1);
  });

  it("저장된 설정 조회 실패는 사용량을 예약하기 전에 전파한다", async () => {
    // Given
    const fixture = createFixture();
    const failure = new Error("preference unavailable");
    vi.spyOn(fixture.localePreferenceReader, "read").mockRejectedValueOnce(failure);
    // When
    const execution = fixture.useCase.execute({ ...fixture.input, locale: undefined });
    // Then
    await expect(execution).rejects.toBe(failure);
    expect((await fixture.quota.read(fixture.userId, "AI_PARSE")).used).toBe(0);
    expect(fixture.generator.getCallCount()).toBe(0);
  });

  it("prompt 생성 실패도 provider 호출 전에 예약 사용량을 보상한다", async () => {
    // Given
    const fixture = createFixture();
    // When
    const execution = fixture.useCase.execute({ ...fixture.input, timezone: "Invalid/Timezone" });
    // Then
    await expect(execution).rejects.toBeInstanceOf(RangeError);
    expect((await fixture.quota.read(fixture.userId, "AI_PARSE")).used).toBe(0);
    expect(fixture.generator.getCallCount()).toBe(0);
  });
});
