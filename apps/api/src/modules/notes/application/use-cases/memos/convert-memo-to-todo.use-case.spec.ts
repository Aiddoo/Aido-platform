import { vi } from "vitest";

import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";

import { ConvertMemoToTodo } from "./convert-memo-to-todo.use-case.js";

describe("ConvertMemoToTodo — 메모 단건 변환", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  it("소유하지 않은 메모는 MEMO_2001로 거부하고 Todo와 후속 작업을 만들지 않는다", async () => {
    // Given
    const memo = fixture.addMemo("다른 사용자 메모", 0, "other-user");
    // When / Then
    await expect(
      new ConvertMemoToTodo(fixture).execute({
        userId: fixture.userId,
        memoId: memo.id,
        data: { categoryId: 1, startDate: NOTES_TIME },
      }),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(fixture.todoCreator.stagedTodos.size).toBe(0);
    expect(fixture.registeredTasks).toEqual([]);
    expect(fixture.repository.records.get(memo.id)).toEqual(memo);
  });

  it("제목을 200자로 제한하고 false·날짜·하위 항목을 전달한 뒤 원본 메모를 삭제한다", async () => {
    // Given
    const memo = fixture.addMemo("가".repeat(300));
    const scheduledTime = new Date("2026-04-06T03:30:00.000Z");
    // When
    const result = await new ConvertMemoToTodo(fixture).execute({
      userId: fixture.userId,
      memoId: memo.id,
      data: {
        categoryId: 1,
        startDate: NOTES_TIME,
        endDate: null,
        scheduledTime,
        isAllDay: false,
        visibility: "PRIVATE",
        items: [{ title: "준비" }],
      },
    });
    // Then
    expect(result.message).toBe("메모가 할 일로 변환되었습니다.");
    expect(result.todo).toMatchObject({
      title: "가".repeat(200),
      startDate: "2026-04-06",
      endDate: null,
      scheduledTime: scheduledTime.toISOString(),
      isAllDay: false,
      visibility: "PRIVATE",
    });
    expect(fixture.todoCreator.singleInputs).toEqual([
      {
        userId: fixture.userId,
        title: "가".repeat(200),
        categoryId: 1,
        startDate: NOTES_TIME,
        endDate: null,
        scheduledTime,
        isAllDay: false,
        visibility: "PRIVATE",
        items: [{ title: "준비" }],
      },
    ]);
    expect(fixture.repository.records.has(memo.id)).toBe(false);
    expect(fixture.registeredTasks).toHaveLength(1);
    expect(fixture.todoCreator.settledTodoIds).toEqual([]);
    await fixture.registeredTasks[0]?.();
    expect(fixture.todoCreator.settledTodoIds).toEqual([result.todo.id]);
  });

  it("선택값을 생략하면 종일·공개 기본값을 유지한다", async () => {
    // Given
    const memo = fixture.addMemo("기본값 변환");
    // When
    const result = await new ConvertMemoToTodo(fixture).execute({
      userId: fixture.userId,
      memoId: memo.id,
      data: { categoryId: 1, startDate: NOTES_TIME },
    });
    // Then
    expect(result.todo).toMatchObject({
      isAllDay: true,
      visibility: "PUBLIC",
      endDate: null,
      scheduledTime: null,
    });
  });

  it("Todo 생성 오류는 원래 오류를 반환하고 메모와 후속 작업을 유지한다", async () => {
    // Given
    const memo = fixture.addMemo("실패 후 유지");
    const failure = new Error("Todo 저장 실패");
    vi.spyOn(fixture.todoCreator, "stageTodo").mockRejectedValueOnce(failure);
    // When / Then
    await expect(
      new ConvertMemoToTodo(fixture).execute({
        userId: fixture.userId,
        memoId: memo.id,
        data: { categoryId: 1, startDate: NOTES_TIME },
      }),
    ).rejects.toBe(failure);
    expect(fixture.repository.records.get(memo.id)).toEqual(memo);
    expect(fixture.registeredTasks).toEqual([]);
    expect(fixture.todoCreator.stagedTodos.size).toBe(0);
  });
});
