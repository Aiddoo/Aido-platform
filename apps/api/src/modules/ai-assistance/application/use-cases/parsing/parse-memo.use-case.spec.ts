import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { AI_QUOTA_TIME, createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";

import { AiProviderCallError } from "../../ports/parsing/ai-provider.port.js";
import { ParseMemo, type ParseMemoInput } from "./parse-memo.use-case.js";

function createTodo(title: string, categoryId: number) {
  return {
    title,
    categoryId,
    startDate: "2026-04-12",
    endDate: null,
    scheduledTime: null,
    isAllDay: true,
    isRecurring: false,
    recurrence: null,
    items: [],
  };
}

function createFixture() {
  const fixture = createAiQuotaFixture();
  fixture.aiProvider.setRawResponse({ todos: [createTodo("팀 미팅", 7)] });
  const useCase = new ParseMemo(fixture);
  const input: ParseMemoInput = {
    userId: fixture.userId,
    content: "내일 팀 미팅",
    timezone: "Asia/Seoul",
    categoryId: 1,
    locale: "ko",
  };
  return { ...fixture, useCase, input };
}

describe("ParseMemo", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AI_QUOTA_TIME);
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
    expect(await fixture.quota.read(fixture.userId)).toMatchObject({ used: 1, limit: 5 });
    expect(result.data.todos).toMatchObject([{ title: "팀 미팅", categoryId: 7 }]);
    expect(result.meta).toMatchObject({
      model: "fake:test-model",
      processingTimeMs: 0,
      tokenUsage: { input: 150, output: 50 },
    });
  });

  it("가용하지 않은 provider는 사용량을 예약하지 않고 AI_1301을 반환한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setAvailable(false);
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1301" });
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
    expect(fixture.aiProvider.getCallCount()).toBe(0);
  });

  it("한도가 소진된 요청은 provider를 호출하지 않고 AI_1303을 반환한다", async () => {
    // Given
    const fixture = createFixture();
    for (let index = 0; index < 5; index += 1) await fixture.quota.reserve(fixture.userId);
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: "AI_1303" });
    expect(fixture.aiProvider.getCallCount()).toBe(0);
  });

  it("소유 카테고리는 유지하고 미지 카테고리는 요청 기본값으로 대체한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider
      .clearResponses()
      .setRawResponse({ todos: [createTodo("업무", 7), createTodo("미지", 999)] });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos.map((todo) => todo.categoryId)).toEqual([7, 1]);
  });

  it("구조화 계약을 초과한 여덟 투두는 성공 로그 없이 거절하고 사용량을 반환한다", async () => {
    // Given: Fake도 production 구조화 schema로 원본 응답을 검증한다.
    const fixture = createFixture();
    fixture.aiProvider.clearResponses().setRawResponse({
      todos: Array.from({ length: 8 }, (_, index) => createTodo(`작업 ${index}`, 7)),
    });
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.AI_1302 });
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
    expect(fixture.logger.log).not.toHaveBeenCalled();
  });

  it.each([
    { error: new AiProviderCallError("provider unavailable", 500), errorCode: "AI_1301" },
    { error: new Error("invalid output"), errorCode: "AI_1302" },
  ])(
    "provider 오류는 $errorCode를 반환하고 예약 사용량을 보상한다",
    async ({ error, errorCode }) => {
      // Given
      const fixture = createFixture();
      fixture.aiProvider.setInvalidResponse(error);
      // When
      const execution = fixture.useCase.execute(fixture.input);
      // Then
      await expect(execution).rejects.toMatchObject({ errorCode });
      expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
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
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
    expect(fixture.aiProvider.getCallCount()).toBe(0);
  });

  it("prompt 생성 실패도 provider 호출 전에 예약 사용량을 보상한다", async () => {
    // Given
    const fixture = createFixture();
    // When
    const execution = fixture.useCase.execute({ ...fixture.input, timezone: "Invalid/Timezone" });
    // Then
    await expect(execution).rejects.toBeInstanceOf(RangeError);
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
    expect(fixture.aiProvider.getCallCount()).toBe(0);
  });

  it("provider가 반환한 여섯 항목은 최종 검증에서 거절하고 성공 로그 없이 사용량을 반환한다", async () => {
    // Given: provider 반환 성공 뒤에 검사할 공개 응답 상한 초과 데이터.
    const fixture = createFixture();
    const todo = {
      ...createTodo("PRIVATE_TODO_TITLE", 7),
      items: Array.from({ length: 6 }, () => ({ title: "PRIVATE_ITEM_TITLE" })),
    };
    vi.spyOn(fixture.aiProvider, "generateStructured").mockResolvedValueOnce({
      output: { todos: [todo] },
      model: "fixture:model",
      usage: { input: 150, output: 50 },
    });
    // When
    const execution = fixture.useCase.execute({ ...fixture.input, content: "PRIVATE_MEMO" });
    // Then: 내용을 임의로 자르지 않고 실패·보상하며 안전한 issue 위치만 기록한다.
    await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.AI_1302 });
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
    expect(fixture.logger.log).not.toHaveBeenCalled();
    expect(fixture.logger.error).toHaveBeenCalledWith({
      event: "ai.parsing.output.invalid",
      userId: fixture.userId,
      errorCode: ErrorCode.AI_1302,
      validationIssues: [{ path: ["todos", 0, "items"], code: "too_big" }],
    });
    const logged = JSON.stringify(fixture.logger.error.mock.calls);
    expect(logged).not.toContain("PRIVATE_");
    expect(logged).not.toContain("message");
    expect(todo.items).toHaveLength(6);
  });

  it("다섯 항목의 유효한 응답은 검증된 개수를 성공 로그에 남긴다", async () => {
    // Given: 응답 계약의 항목 상한을 정확히 만족한다.
    const fixture = createFixture();
    fixture.aiProvider.clearResponses().setRawResponse({
      todos: [
        {
          ...createTodo("프로젝트 준비", 7),
          items: Array.from({ length: 5 }, (_, i) => ({ title: `단계 ${i + 1}` })),
        },
      ],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos[0]?.items).toHaveLength(5);
    expect((await fixture.quota.read(fixture.userId)).used).toBe(1);
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ai.parsing.memo.completed", todoCount: 1, itemCount: 5 }),
    );
    expect(fixture.logger.error).not.toHaveBeenCalled();
  });

  it("provider의 rate-limit ApplicationException은 기존 코드와 identity를 유지하고 사용량을 반환한다", async () => {
    // Given
    const fixture = createFixture();
    const failure = new ApplicationException(ErrorCode.AI_1310);
    fixture.aiProvider.setInvalidResponse(failure);
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toBe(failure);
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
    expect(fixture.logger.log).not.toHaveBeenCalled();
  });
});
