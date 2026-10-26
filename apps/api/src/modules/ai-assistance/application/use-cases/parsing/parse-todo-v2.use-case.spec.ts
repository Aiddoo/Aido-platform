import { ErrorCode } from "@aido/api/errors";

import { createAiQuotaFixture } from "#test/fixtures/ai-quota.fixture";

import { AiProviderError } from "../../ports/parsing/ai-provider.port.js";
import { ParseTodo, type ParseTodoInput } from "./parse-todo.use-case.js";

// 서울 2026-10-28(수) 10:00
const NOW = new Date("2026-10-28T01:00:00Z");

function createFixture() {
  const fixture = createAiQuotaFixture();
  const useCase = new ParseTodo(fixture);
  const input: ParseTodoInput = {
    userId: fixture.userId,
    text: "내일 오후 3시 팀 미팅",
    timezone: "Asia/Seoul",
    categoryId: undefined,
    locale: "ko",
  };
  return { ...fixture, useCase, input };
}

describe("ParseTodo — v2 표현 해석 + 서버 일정 계산", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("모델이 고른 표현을 서버가 사용자 로컬 날짜·시각으로 계산하고 프롬프트 버전을 돌려준다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
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
      categoryId: 7,
    });
    expect(result.meta.promptVersion).toBe("parse-todo@v2.1");
    expect(fixture.aiProvider.getLastOptions()?.promptVersion).toBe("parse-todo@v2.1");
    expect((await fixture.quota.read(fixture.userId)).used).toBe(1);
  });

  it("프롬프트 system에는 날짜가 없고 user 턴에 연도를 포함한 로컬 시각이 들어간다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
      intent: "TASK",
      title: "팀 미팅",
      date: { kind: "NONE" },
      time: null,
      repeat: { pattern: "NONE" },
    });
    // When
    await fixture.useCase.execute({ ...fixture.input, timezone: "America/Los_Angeles" });
    // Then
    expect(fixture.aiProvider.getLastSystem()).not.toMatch(/2026-\d\d-\d\d/);
    expect(fixture.aiProvider.getLastPrompt()).toContain('"now": "2026-10-27T18:00"');
    expect(fixture.aiProvider.getLastPrompt()).toContain('"weekday": "화요일"');
  });

  it("모델 대상 명령만 있는 입력은 앱 언어 문구로 바꾸고 사용량을 차감하지 않는다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setRawResponse({
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
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
    expect(fixture.logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "NO_ACTION", quotaCharged: false }),
    );
  });

  it("빈 제목은 원문으로 대신하고 200자를 넘는 제목은 문자 경계로 자른다", async () => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider
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
    fixture.aiProvider.setRawResponse(draft).setRawResponse(draft);
    // When
    const inferred = await fixture.useCase.execute(fixture.input);
    const requested = await fixture.useCase.execute({ ...fixture.input, categoryId: 3 });
    // Then
    expect(inferred.data.categoryId).toBeUndefined();
    expect(requested.data.categoryId).toBe(3);
  });

  it.each([
    { kind: "RATE_LIMITED" as const, errorCode: ErrorCode.AI_1310 },
    { kind: "TIMEOUT" as const, errorCode: ErrorCode.AI_1301 },
    { kind: "TRUNCATED" as const, errorCode: ErrorCode.AI_1302 },
  ])("$kind 실패는 $errorCode로 응답하고 사용량을 돌려준다", async ({ kind, errorCode }) => {
    // Given
    const fixture = createFixture();
    fixture.aiProvider.setInvalidResponse(new AiProviderError(kind, undefined));
    // When
    const execution = fixture.useCase.execute(fixture.input);
    // Then
    await expect(execution).rejects.toMatchObject({ errorCode });
    expect((await fixture.quota.read(fixture.userId)).used).toBe(0);
  });
});
