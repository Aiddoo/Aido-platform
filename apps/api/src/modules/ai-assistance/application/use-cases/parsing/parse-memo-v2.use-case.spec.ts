import { createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";

import { ParseMemo, type ParseMemoInput } from "./parse-memo.use-case.js";

// 서울 2026-10-28(수) 10:00
const NOW = new Date("2026-10-28T01:00:00Z");

function draftTodo(title: string, overrides: Record<string, unknown> = {}) {
  return {
    intent: "TASK",
    title,
    date: { kind: "NONE" },
    time: null,
    repeat: { pattern: "NONE" },
    items: [],
    ...overrides,
  };
}

function createFixture() {
  const fixture = createAiQuotaFixture();
  const useCase = new ParseMemo(fixture);
  const input: ParseMemoInput = {
    userId: fixture.userId,
    content: "메모 원문",
    timezone: "Asia/Seoul",
    categoryId: 1,
    locale: "ko",
  };
  return { ...fixture, useCase, input };
}

describe("ParseMemo — v2 정규화", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { draftCount: 5, keptCount: 5, omittedTodoCount: 0 },
    { draftCount: 6, keptCount: 5, omittedTodoCount: 1 },
    { draftCount: 12, keptCount: 5, omittedTodoCount: 7 },
  ])(
    "할 일 $draftCount개는 합치지 않고 입력 순서대로 $keptCount개만 만들며 남은 $omittedTodoCount개를 알린다",
    async ({ draftCount, keptCount, omittedTodoCount }) => {
      // Given
      const fixture = createFixture();
      const titles = Array.from({ length: draftCount }, (_, index) => `할 일 ${index + 1}`);
      fixture.aiProvider.setRawResponse({ todos: titles.map((title) => draftTodo(title)) });
      // When
      const result = await fixture.useCase.execute(fixture.input);
      // Then
      expect(result.data.todos.map((todo) => todo.title)).toEqual(titles.slice(0, keptCount));
      expect(result.meta.omittedTodoCount).toBe(omittedTodoCount);
      expect(fixture.logger.log).toHaveBeenCalledWith(
        expect.objectContaining({ todoCount: keptCount, omittedTodoCount }),
      );
    },
  );

  it("할 일 0개면 안내 할 일 하나만 돌려주고 남은 할 일은 0개다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({ todos: [] });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos.map((todo) => todo.title)).toEqual(["입력 확인 필요"]);
    expect(result.meta.omittedTodoCount).toBe(0);
  });

  it("모델 대상 명령은 남은 할 일 수에 세지 않는다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
      todos: [
        draftTodo("ignored", { intent: "NO_ACTION" }),
        ...Array.from({ length: 6 }, (_, index) => draftTodo(`할 일 ${index + 1}`)),
      ],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos[0]?.title).toBe("할 일 1");
    expect(result.meta.omittedTodoCount).toBe(1);
  });

  it("7개 항목은 합치지 않고 앞의 5개만 두며 제목 반복·빈 항목은 뺀다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
      todos: [
        draftTodo("발표 준비", {
          items: [
            { title: "발표 준비" },
            { title: " " },
            ...Array.from({ length: 7 }, (_, index) => ({ title: `단계 ${index + 1}` })),
          ],
        }),
      ],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos[0]?.items.map((item) => item.title)).toEqual([
      "단계 1",
      "단계 2",
      "단계 3",
      "단계 4",
      "단계 5",
    ]);
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ warnings: ["ITEMS_TRUNCATED"] }),
    );
  });

  it("201자 제목은 200자로 자르고 미소유 카테고리는 요청 기본값으로 바꾼다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
      todos: [
        draftTodo("가".repeat(201), { categoryId: 999 }),
        draftTodo("업무 정리", { categoryId: 7 }),
      ],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos[0]?.title).toHaveLength(200);
    expect(result.data.todos.map((todo) => todo.categoryId)).toEqual([1, 7]);
  });

  it("메모 앞머리 날짜와 시각은 서버가 계산한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
      todos: [
        draftTodo("은행", {
          date: { kind: "OFFSET_DAYS", amount: 1 },
          time: { hour: 3, minute: 0, meridiem: "NONE" },
        }),
      ],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos[0]).toMatchObject({
      startDate: "2026-10-29",
      scheduledTime: "15:00",
      isAllDay: false,
    });
    expect(result.meta.promptVersion).toBe("parse-memo@v2");
  });

  it("모든 할 일이 모델 대상 명령이면 안내 할 일 하나만 돌려주고 사용량을 차감하지 않는다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
      todos: [draftTodo("ignored", { intent: "NO_ACTION" })],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos).toEqual([
      expect.objectContaining({ title: "입력 확인 필요", categoryId: 1, items: [] }),
    ]);
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
  });

  it("NO_ACTION과 실제 할 일이 섞이면 실제 할 일만 남기고 사용량을 차감한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
      todos: [draftTodo("ignored", { intent: "NO_ACTION" }), draftTodo("전기요금 납부")],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos.map((todo) => todo.title)).toEqual(["전기요금 납부"]);
    expect((await fixture.quota.read(fixture.userId)).used).toBe(1);
  });
});
