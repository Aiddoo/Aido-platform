import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG } from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createAiParsingFixture } from "#test/fixtures/ai-parsing.fixture";
import { readPromptBlock } from "#test/fixtures/ai-prompt.fixture";
import { createAiGenerationError } from "#test/mocks/fake-ai.generator";

import { ParseMemoUseCase, type ParseMemoCommand } from "./parse-memo.use-case.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

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
  const fixture = createAiParsingFixture();
  const useCase = new ParseMemoUseCase(fixture);
  const input: ParseMemoCommand = {
    userId: fixture.userId,
    content: "메모 원문",
    timezone: "Asia/Seoul",
    categoryId: 1,
    locale: "ko",
    idempotencyKey: null,
  };
  return { ...fixture, useCase, input };
}

describe("ParseMemoUseCase", () => {
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

  describe("이미 있는 할 일과 겹침", () => {
    const upcoming = [
      { id: 41, title: "치과 예약", startDate: "2026-10-29", isRepeating: false },
      { id: 42, title: "영어 단어 30개", startDate: "2026-10-28", isRepeating: true },
    ];
    const tomorrow = { date: { kind: "OFFSET_DAYS", amount: 1 } };

    it.each([
      {
        why: "모델이 고른 목록 안의 id를 쓴다",
        todo: draftTodo("완전히 다른 제목", { duplicateOfTodoId: 41 }),
        expected: 41,
      },
      {
        why: "모델이 못 골라도 띄어쓰기만 다른 제목과 같은 날이면 찾는다",
        todo: draftTodo("치과예약", tomorrow),
        expected: 41,
      },
      {
        why: "제목이 같아도 다른 날이면 겹치지 않는다",
        todo: draftTodo("치과 예약"),
        expected: null,
      },
      {
        why: "진행 중인 반복 할 일은 날짜가 달라도 겹친다",
        todo: draftTodo("영어 단어 30개", tomorrow),
        expected: 42,
      },
      {
        why: "목록에 없는 id는 버린다",
        todo: draftTodo("우유 사기", { duplicateOfTodoId: 999 }),
        expected: null,
      },
    ])("$why", async ({ todo, expected }) => {
      // Given
      const fixture = createFixture();
      fixture.upcomingTodoReader.todos = upcoming;
      fixture.generator.setRawResponse({ todos: [todo] });
      // When
      const result = await fixture.useCase.execute(fixture.input);
      // Then
      expect(result.data.todos[0]?.duplicateOfTodoId).toBe(expected);
    });

    it("빠른 계획과 같은 맥락으로 다가오는 할 일을 프롬프트에 싣는다", async () => {
      // Given
      const fixture = createFixture();
      fixture.upcomingTodoReader.todos = upcoming;
      fixture.generator.setRawResponse({ todos: [draftTodo("우유 사기")] });
      // When
      await fixture.useCase.execute(fixture.input);
      // Then
      expect(
        readPromptBlock(fixture.generator.getLastRequest()?.prompt ?? "", "context"),
      ).toMatchObject({
        upcomingTodos: [
          { id: 41, title: "치과 예약", date: "2026-10-29", repeating: false },
          { id: 42, title: "영어 단어 30개", date: "2026-10-28", repeating: true },
        ],
      });
    });

    it("실행할 행동이 없는 메모는 제목이 같아도 겹침으로 표시하지 않는다", async () => {
      // Given
      const fixture = createFixture();
      fixture.upcomingTodoReader.todos = [
        { id: 43, title: "입력 확인 필요", startDate: "2026-10-28", isRepeating: true },
      ];
      fixture.generator.setRawResponse({ todos: [draftTodo("", { intent: "NO_ACTION" })] });
      // When
      const result = await fixture.useCase.execute(fixture.input);
      // Then
      expect(result.data.todos[0]?.duplicateOfTodoId).toBeNull();
    });
  });

  it("성공한 요청은 사용량 한 회를 유지하고 데이터와 모델 정보를 반환한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({ todos: [draftTodo("팀 미팅", { categoryId: 7 })] });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).toMatchObject(
      {
        used: 1,
        limit: FREE_AI_LIMIT,
      },
    );
    expect(result.featureQuota).toMatchObject({ feature: "AI_PARSE", used: 1 });
    expect(result.data.todos).toMatchObject([{ title: "팀 미팅", categoryId: 7 }]);
    expect(result.meta).toMatchObject({
      model: "fake:test-model",
      processingTimeMs: 0,
      tokenUsage: { input: 150, output: 50 },
      promptVersion: "parse-memo@9",
    });
  });

  describe("Idempotency-Key 차감 규칙", () => {
    const todos = { todos: [draftTodo("팀 미팅")] };

    it("키가 없는 출시 앱 요청은 요청마다 차감한다", async () => {
      // Given
      const fixture = createFixture();
      fixture.generator.setRawResponse(todos);
      await fixture.useCase.execute(fixture.input);
      fixture.generator.setRawResponse(todos);
      // When
      const second = await fixture.useCase.execute(fixture.input);
      // Then
      expect(second.featureQuota).toMatchObject({ used: 2 });
    });

    it("같은 키로 다시 보내면 결과를 다시 만들어 주되 한 번만 차감한다", async () => {
      // Given
      const fixture = createFixture();
      fixture.generator.setRawResponse(todos);
      const input = { ...fixture.input, idempotencyKey: "memo-key" };
      await fixture.useCase.execute(input);
      fixture.generator.setRawResponse(todos);
      // When
      const retried = await fixture.useCase.execute(input);
      // Then
      expect(retried.data.todos).toMatchObject([{ title: "팀 미팅" }]);
      expect(retried.featureQuota).toMatchObject({ used: 1 });
    });

    it("같은 키로 내용이 다르면 AI_1318로 거절하고 차감하지 않는다", async () => {
      // Given
      const fixture = createFixture();
      fixture.generator.setRawResponse(todos);
      const input = { ...fixture.input, idempotencyKey: "memo-key" };
      await fixture.useCase.execute(input);
      // When
      const pending = fixture.useCase.execute({ ...input, content: "다른 메모" });
      // Then
      await expect(pending).rejects.toMatchObject({ errorCode: ErrorCode.AI_1318 });
      expect(
        await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE"),
      ).toMatchObject({ used: 1 });
    });

    it("실패해 환불한 키로 다시 보내면 성공한 한 번만 차감한다", async () => {
      // Given
      const fixture = createFixture();
      const input = { ...fixture.input, idempotencyKey: "memo-key" };
      fixture.generator.setRawResponse({ wrong: true });
      await expect(fixture.useCase.execute(input)).rejects.toMatchObject({
        errorCode: ErrorCode.AI_1302,
      });
      fixture.generator.setRawResponse(todos);
      // When
      const retried = await fixture.useCase.execute(input);
      // Then
      expect(retried.featureQuota).toMatchObject({ used: 1 });
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
    fixture.generator.setRawResponse({ todos: [draftTodo("보고서 쓰기")], totalTaskCount: 1 });
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
      task: "parse-memo",
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
      await expect(execution).rejects.toMatchObject({ errorCode, details: { charged: false } });
      expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
        0,
      );
    },
  );

  it("스키마에 맞지 않는 모델 출력은 AI_1302로 거절하고 사용량을 돌려준다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({ todos: [{ title: "날짜 표현 없음" }] });
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.AI_1302 });
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(fixture.logger.log).not.toHaveBeenCalled();
  });

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

  it("공개 계약 검증에 실패하면 원문 없이 위치만 기록하고 AI_1302로 사용량을 돌려준다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({ todos: [draftTodo("PRIVATE_TODO_TITLE")] });
    // When
    const execution = fixture.useCase.execute({
      ...fixture.input,
      content: "PRIVATE_MEMO",
      categoryId: 0,
    });
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.AI_1302 });
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(fixture.logger.log).not.toHaveBeenCalled();
    expect(fixture.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.generation.failed",
        task: "parse-memo",
        userId: fixture.userId,
        errorType: "INVALID_OUTPUT",
        errorCode: ErrorCode.AI_1302,
        quotaCharged: false,
        validationIssues: [{ path: ["todos", 0, "categoryId"], code: "too_small" }],
      }),
    );
    const logged = JSON.stringify(fixture.logger.error.mock.calls);
    expect(logged).not.toContain("PRIVATE_");
    expect(logged).not.toContain("message");
  });

  it("다섯 항목의 유효한 응답은 검증된 개수를 성공 로그에 남긴다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      todos: [
        draftTodo("프로젝트 준비", {
          categoryId: 7,
          items: Array.from({ length: 5 }, (_, index) => ({ title: `단계 ${index + 1}` })),
        }),
      ],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos[0]?.items).toHaveLength(5);
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      1,
    );
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.generation.completed",
        task: "parse-memo",
        quotaCharged: true,
        todoCount: 1,
        itemCount: 5,
      }),
    );
    expect(fixture.logger.error).not.toHaveBeenCalled();
  });

  it("재시도가 소진된 요청 과다는 파싱 실패가 아닌 AI_1310으로 반환하고 실패 종류를 기록한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setInvalidResponse(createAiGenerationError("RATE_LIMITED"));
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.AI_1310 });
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(fixture.logger.log).not.toHaveBeenCalled();
    expect(fixture.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ai.generation.failed", errorType: "RATE_LIMITED" }),
    );
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
      fixture.generator.setRawResponse({ todos: titles.map((title) => draftTodo(title)) });
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

  it("12개 할 일 메모에서 모델이 앞의 8개와 전체 수 12를 주면 5개만 만들고 남은 7개를 알린다", async () => {
    // Given
    const fixture = createFixture();
    const titles = Array.from({ length: 12 }, (_, index) => `할 일 ${index + 1}`);
    fixture.generator.setRawResponse({
      totalTaskCount: 12,
      todos: titles.slice(0, 8).map((title) => draftTodo(title)),
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos.map((todo) => todo.title)).toEqual(titles.slice(0, 5));
    expect(result.meta.omittedTodoCount).toBe(7);
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ todoCount: 5, omittedTodoCount: 7 }),
    );
  });

  it.each([
    { case: "빠뜨리면", totalTaskCount: undefined },
    { case: "실제로 쓴 것보다 적게 세면", totalTaskCount: 3 },
    { case: "음수로 주면", totalTaskCount: -1 },
  ])(
    "모델이 전체 할 일 수를 $case 받은 할 일 수로 남은 개수를 계산한다",
    async ({ totalTaskCount }) => {
      // Given
      const fixture = createFixture();
      fixture.generator.setRawResponse({
        ...(totalTaskCount != null && { totalTaskCount }),
        todos: Array.from({ length: 8 }, (_, index) => draftTodo(`할 일 ${index + 1}`)),
      });
      // When
      const result = await fixture.useCase.execute(fixture.input);
      // Then
      expect(result.data.todos).toHaveLength(5);
      expect(result.meta.omittedTodoCount).toBe(3);
    },
  );

  it("실제 할 일이 없으면 모델이 센 전체 수와 관계없이 남은 할 일은 0개다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      totalTaskCount: 4,
      todos: [draftTodo("ignored", { intent: "NO_ACTION" })],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos.map((todo) => todo.title)).toEqual(["입력 확인 필요"]);
    expect(result.meta.omittedTodoCount).toBe(0);
  });

  it("할 일 0개면 안내 할 일 하나만 돌려주고 남은 할 일은 0개다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({ todos: [] });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos.map((todo) => todo.title)).toEqual(["입력 확인 필요"]);
    expect(result.meta.omittedTodoCount).toBe(0);
  });

  it("모델 대상 명령은 남은 할 일 수에 세지 않는다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
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
    fixture.generator.setRawResponse({
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
    fixture.generator.setRawResponse({
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
    fixture.generator.setRawResponse({
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
    expect(result.meta.promptVersion).toBe("parse-memo@9");
  });

  it("모든 할 일이 모델 대상 명령이면 안내 할 일 하나만 돌려주고 사용량을 차감하지 않는다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      todos: [draftTodo("ignored", { intent: "NO_ACTION" })],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos).toEqual([
      expect.objectContaining({ title: "입력 확인 필요", categoryId: 1, items: [] }),
    ]);
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      0,
    );
    expect(result.featureQuota).toMatchObject({ used: 0 });
    expect([...fixture.quotaChargeRepository.all]).toMatchObject([
      { status: "REFUNDED", refundReason: "NO_ACTION", reason: "parse-memo" },
    ]);
  });

  it("NO_ACTION과 실제 할 일이 섞이면 실제 할 일만 남기고 사용량을 차감한다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      todos: [draftTodo("ignored", { intent: "NO_ACTION" }), draftTodo("전기요금 납부")],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos.map((todo) => todo.title)).toEqual(["전기요금 납부"]);
    expect((await fixture.quota.read(UserId.reconstitute(fixture.userId), "AI_PARSE")).used).toBe(
      1,
    );
  });

  it("모델이 전체 할 일 수를 터무니없이 크게 주면 상한 100개 기준으로 남은 수를 알린다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      totalTaskCount: 99_999_999,
      todos: Array.from({ length: 8 }, (_, index) => draftTodo(`할 일 ${index + 1}`)),
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.meta.omittedTodoCount).toBe(95);
  });

  it("모델 출력의 스키마 밖 필드는 버리고 제목·항목의 보이지 않는 문자는 지운다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      userId: "other-user",
      todos: [
        draftTodo("우유\u200B 사기\u202E\u{E0041}", {
          categoryId: 999_999,
          ownerId: "other-user",
          items: [{ title: "\u2066마트\u2069", url: "https://evil.example" }],
        }),
      ],
    });
    // When
    const result = await fixture.useCase.execute(fixture.input);
    // Then
    expect(result.data.todos).toEqual([
      expect.objectContaining({ title: "우유 사기", categoryId: 1, items: [{ title: "마트" }] }),
    ]);
    expect(JSON.stringify(result)).not.toContain("other-user");
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });

  it("성공 로그에 모델이 낸 날짜 표현의 kind·weekOffset만 남긴다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({
      todos: [
        draftTodo("PRIVATE_TITLE", { date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 0 } }),
        draftTodo("우유 사기"),
      ],
    });
    // When
    await fixture.useCase.execute(fixture.input);
    // Then
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRefs: [
          { kind: "WEEKDAY", weekOffset: 0 },
          { kind: "NONE", weekOffset: null },
        ],
      }),
    );
    expect(JSON.stringify(fixture.logger.log.mock.calls)).not.toContain("PRIVATE_TITLE");
  });

  it("성공 로그에는 메모 원문과 모델이 만든 제목을 남기지 않는다", async () => {
    // Given
    const fixture = createFixture();
    fixture.generator.setRawResponse({ todos: [draftTodo("PRIVATE_TITLE")] });
    // When
    await fixture.useCase.execute({ ...fixture.input, content: "PRIVATE_MEMO_TEXT" });
    // Then
    const logged = JSON.stringify([fixture.logger.log.mock.calls, fixture.logger.warn.mock.calls]);
    expect(logged).not.toContain("PRIVATE_MEMO_TEXT");
    expect(logged).not.toContain("PRIVATE_TITLE");
  });
});
