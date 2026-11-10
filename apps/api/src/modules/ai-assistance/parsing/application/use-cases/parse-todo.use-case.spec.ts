import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createAiParsingFixture } from "#test/fixtures/ai-parsing.fixture";
import { createAiGenerationError } from "#test/mocks/fake-ai.generator";

import { ParseTodoUseCase, type ParseTodoCommand } from "./parse-todo.use-case.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

// 서울 2026-10-28(수) 10:00
const NOW = new Date("2026-10-28T01:00:00Z");

function createFixture() {
  const fixture = createAiParsingFixture();
  fixture.generator.setDefaultResponse({
    title: "팀 미팅",
    date: { kind: "OFFSET_DAYS", amount: 1 },
    categoryId: 7,
  });
  const useCase = new ParseTodoUseCase(fixture);
  const input: ParseTodoCommand = {
    userId: fixture.userId,
    text: "내일 오후 3시 팀 미팅",
    timezone: "Asia/Seoul",
    categoryId: undefined,
    locale: "ko",
  };
  return { ...fixture, useCase, input };
}

describe("ParseTodoUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    try {
      vi.restoreAllMocks();
    } finally {
      vi.useRealTimers();
    }
  });

  it("모델이 고른 표현을 서버가 사용자 로컬 날짜·시각으로 계산하고 프롬프트 버전을 돌려준다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      intent: "TASK",
      title: "  팀   미팅 ",
      date: { kind: "OFFSET_DAYS", amount: 1 },
      time: { hour: 3, minute: 0, meridiem: "PM" },
      repeat: { pattern: "NONE" },
      categoryId: 7,
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data).toEqual({
      title: "팀 미팅",
      startDate: "2026-10-29",
      endDate: null,
      scheduledTime: "15:00",
      isAllDay: false,
      isRecurring: false,
      recurrence: null,
      repeat: null,
      categoryId: 7,
    });
    expect(result.meta.promptVersion).toBe("parse-todo@9");
    expect(fixture.generator.getLastRequest()?.promptVersion).toBe("parse-todo@9");
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      1,
    );
  });

  it("프롬프트 system에는 날짜가 없고 user 턴에 연도를 포함한 로컬 시각이 들어간다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      intent: "TASK",
      title: "팀 미팅",
      date: { kind: "NONE" },
      time: null,
      repeat: { pattern: "NONE" },
    });
    // When
    await fixture.useCase.execute({ ...fixture.input, timezone: "America/Los_Angeles" });
    // Then
    expect(fixture.generator.getLastSystem()).not.toMatch(/2026-\d\d-\d\d/);
    expect(fixture.generator.getLastPrompt()).toContain('"now": "2026-10-27T18:00"');
    expect(fixture.generator.getLastPrompt()).toContain('"weekday": "화요일"');
  });

  it("모델 대상 명령만 있는 입력은 앱 언어 문구로 바꾸고 사용량을 차감하지 않는다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      intent: "NO_ACTION",
      title: "ignored",
      date: { kind: "OFFSET_DAYS", amount: 3 },
      time: { hour: 9 },
      repeat: { pattern: "DAILY" },
      categoryId: 7,
    });
    // When
    const result = await fixture.useCase.execute({ ...fixture.input, locale: "en" });
    // Then
    expect(result.data).toMatchObject({
      title: "Needs review",
      startDate: "2026-10-28",
      isAllDay: true,
      isRecurring: false,
    });
    expect(result.data.categoryId).toBeUndefined();
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(result.featureQuota).toMatchObject({ used: 0 });
    expect([...fixture.quotaChargeRepository.all]).toMatchObject([
      { status: "REFUNDED", refundReason: "NO_ACTION" },
    ]);
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "NO_ACTION", quotaCharged: false }),
    );
  });

  it("빈 제목은 원문으로 대신하고 200자를 넘는 제목은 문자 경계로 자른다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator
      .setRawResponse({
        intent: "TASK",
        title: "가".repeat(199) + "😀",
        date: { kind: "NONE" },
        time: null,
        repeat: { pattern: "NONE" },
      })
      .setRawResponse({
        intent: "TASK",
        title: "   ",
        date: { kind: "NONE" },
        time: null,
        repeat: { pattern: "NONE" },
      });
    // When
    const long = await fixture.useCase.execute(fixture.input);
    const empty = await fixture.useCase.execute(fixture.input);
    // Then
    expect(long.data.title).toBe("가".repeat(199));
    expect(empty.data.title).toBe("내일 오후 3시 팀 미팅");
  });

  it("소유하지 않은 카테고리는 버리고 요청 카테고리가 있으면 그것을 쓴다", async () => {
    // Given
    const fixture = createFixture();
    const draft = {
      intent: "TASK",
      title: "운동",
      date: { kind: "NONE" },
      time: null,
      repeat: { pattern: "NONE" },
      categoryId: 999,
    };
    fixture.generator.setRawResponse(draft).setRawResponse(draft);
    // When
    const inferred = await fixture.useCase.execute(fixture.input);
    const requested = await fixture.useCase.execute({ ...fixture.input, categoryId: 3 });
    // Then
    expect(inferred.data.categoryId).toBeUndefined();
    expect(requested.data.categoryId).toBe(3);
  });

  it("스키마에 맞지 않는 모델 출력은 AI_1302로 거절하고 사용량을 돌려준다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({});
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1302" });
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(fixture.generator.getCallCount()).toBe(1);
  });

  it("Fake clear는 이전 테스트의 default와 raw queue·실패·usage 설정을 모두 초기화한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator
      .setRawResponse({})
      .setAvailable(false)
      .setInvalidResponse()
      .setTokenUsage({ input: 1 })
      .setDelay(1);
    // When
    fixture.generator.clear();
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.title).toBe("테스트 할 일");
    expect(result.meta.tokenUsage).toEqual({ input: 150, output: 50 });
    expect(fixture.generator.getCallCount()).toBe(1);
  });

  it("성공한 요청은 사용량 한 회를 유지하고 데이터와 모델 정보를 반환한다", async () => {
    // Given
    const fixture = createFixture();
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).toMatchObject(
      {
        used: 1,
        limit: FREE_AI_LIMIT,
      },
    );
    expect(result.featureQuota).toMatchObject({
      feature: "AI_PARSE",
      used: 1,
      remaining: FREE_AI_LIMIT - 1,
    });
    expect([...fixture.quotaChargeRepository.all]).toMatchObject([
      { status: "COMMITTED", reason: "parse-todo", idempotencyKey: null },
    ]);
    expect(result.data).toMatchObject({ title: "팀 미팅", categoryId: 7 });
    expect(result.meta).toMatchObject({
      model: "fake:test-model",
      processingTimeMs: 0,
      tokenUsage: { input: 150, output: 50 },
    });
  });

  it("환불이 저장되지 않으면 차감 없음을 주장하지 않고 같은 오류 코드만 준다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setInvalidResponse(createAiGenerationError("UPSTREAM"));
    vi.spyOn(fixture.quotaChargeRepository, "saveIfUnchanged").mockRejectedValue(
      new TypeError("db down"),
    );
    // When
    const failure = await fixture.useCase.execute(fixture.input).catch((cause: unknown) => cause);
    // Then
    expect(failure).toMatchObject({ errorCode: "AI_1301" });
    expect(Reflect.get(Object(failure), "details")).toBeUndefined();
  });

  it("확정 뒤 한도를 읽지 못해도 결과를 살리고 featureQuota 없이 돌려주며 원인 종류만 남긴다", async () => {
    // Given
    const fixture = createFixture();
    vi.spyOn(fixture.quota, "read").mockRejectedValue(new TypeError("db down"));
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.featureQuota).toBeNull();
    expect(result.data).toBeDefined();
    expect([...fixture.quotaChargeRepository.all][0]).toMatchObject({ status: "COMMITTED" });
    expect(fixture.logger.warn).toHaveBeenCalledWith({
      event: "ai.generation.quota-read-failed",
      feature: "AI_PARSE",
      task: "parse-todo",
      errorType: "TypeError",
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
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
  });

  it("한도가 소진된 요청은 provider를 호출하지 않고 AI_1303을 반환한다", async () => {
    // Given
    const fixture = createFixture();
    for (let index = 0; index < FREE_AI_LIMIT; index += 1) {
      await fixture.quota.reserve({
        userId: UserId.reconstitute(fixture.userId),
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
      expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
        0,
      );
      expect([...fixture.quotaChargeRepository.all]).toMatchObject([
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
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(fixture.generator.getCallCount()).toBe(0);
  });

  it("동의한 안내 버전과 프롬프트 버전을 생성기에 넘기고 원문 없이 업체·비용과 생성 결과를 기록한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.consentReader.decision = "AGREED";
    fixture.consentReader.agreedVersion = "2026-10-26";
    fixture.generator.setTokenUsage({ reasoning: 12 });
    // When
    await fixture.useCase.execute({ ...fixture.input, text: "PRIVATE_TODO_TEXT" });
    // Then
    expect(fixture.generator.getLastRequest()).toMatchObject({
      task: "parse-todo",
      taskClass: "interactive",
      userId: fixture.input.userId,
      maxInputChars: 5_000,
      promptVersion: "parse-todo@9",
      agreedConsentVersion: "2026-10-26",
    });
    expect(fixture.logger.log).toHaveBeenCalledWith({
      event: "ai.generation.completed",
      task: "parse-todo",
      promptVersion: "parse-todo@9",
      provider: "google",
      model: "fake:test-model",
      attempts: 1,
      fallbackFrom: null,
      estimatedCostMicroUsd: 0,
      latencyMs: 0,
      inputTokens: 150,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
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
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(fixture.generator.getCallCount()).toBe(0);
  });

  it("prompt 생성 실패도 provider 호출 전에 예약 사용량을 보상한다", async () => {
    // Given
    const fixture = createFixture();
    // When
    const execution = fixture.useCase.execute({ ...fixture.input, timezone: "Invalid/Timezone" });
    // Then
    await expect(execution).rejects.toBeInstanceOf(RangeError);
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(fixture.generator.getCallCount()).toBe(0);
  });
});
