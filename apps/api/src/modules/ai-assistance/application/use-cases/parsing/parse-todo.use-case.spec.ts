import { AI_QUOTA_TIME, createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";

import { AiProviderCallError } from "../../ports/parsing/ai-provider.port.js";
import { ParseTodo, type ParseTodoInput } from "./parse-todo.use-case.js";

function createFixture() {
  const fixture = createAiQuotaFixture();
  fixture.aiProvider.setDefaultResponse({
    title: "팀 미팅",
    startDate: "2026-04-12",
    categoryId: 7,
  });
  const useCase = new ParseTodo(fixture);
  const input: ParseTodoInput = {
    userId: fixture.userId,
    text: "내일 팀 미팅",
    timezone: "Asia/Seoul",
    categoryId: undefined,
    locale: "ko",
  };
  return { ...fixture, useCase, input };
}

describe("ParseTodo", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AI_QUOTA_TIME);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("성공한 요청은 사용량 한 회를 유지하고 데이터와 모델 정보를 반환한다", async () => {
    // Given
    const fixture = createFixture();
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(await fixture.quota.read(fixture.userId)).toMatchObject({ used: 1, limit: 5 });
    expect(result.data).toMatchObject({ title: "팀 미팅", categoryId: 7 });
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

  it("소유하지 않은 추론 카테고리는 응답에서 제외한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setResponse({ categoryId: 999 });
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
});
