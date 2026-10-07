import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { TodoBuilder } from "#test/builders/todo.builder";
import { createNotesMemoFixture, NOTES_TIME } from "#test/fixtures/notes-memo.fixture";
import { createTodoResponseFixture } from "#test/fixtures/todo-response.fixture";

import {
  ConvertMemoToTodos,
  type ConvertMemoToTodosInput,
} from "./convert-memo-to-todos.use-case.js";

describe("ConvertMemoToTodos — 메모 일괄 변환", () => {
  let fixture: ReturnType<typeof createNotesMemoFixture>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOTES_TIME);
    fixture = createNotesMemoFixture();
  });
  afterEach(() => vi.useRealTimers());

  function input(
    memoId: number,
    todos: ConvertMemoToTodosInput["data"]["todos"],
  ): ConvertMemoToTodosInput {
    return { userId: fixture.userId, memoId, data: { todos }, timezone: "Asia/Seoul" };
  }

  it("소유하지 않은 메모는 MEMO_2001로 거부하고 어느 항목도 생성하지 않는다", async () => {
    // Given
    const memo = fixture.addMemo("다른 사용자", 0, "other-user");
    // When / Then
    await expect(
      new ConvertMemoToTodos(fixture).execute(
        input(memo.id, [{ title: "할 일", categoryId: 1, startDate: NOTES_TIME }]),
      ),
    ).rejects.toMatchObject({ errorCode: "MEMO_2001" });
    expect(fixture.todoCreator.stagedTodos.size).toBe(0);
    expect(fixture.registeredTasks).toEqual([]);
    expect(fixture.repository.records.get(memo.id)).toEqual(memo);
  });

  it("단건 항목을 입력 순서대로 생성하고 모든 항목 성공 후 메모를 삭제한다", async () => {
    // Given
    const memo = fixture.addMemo("장보기와 청소");
    // When
    const result = await new ConvertMemoToTodos(fixture).execute(
      input(memo.id, [
        { title: "장보기", categoryId: 1, startDate: NOTES_TIME },
        {
          title: "청소",
          categoryId: 1,
          startDate: NOTES_TIME,
          isAllDay: false,
          visibility: "PRIVATE",
        },
      ]),
    );
    // Then
    expect(result.todos.map((todo) => todo.title)).toEqual(["장보기", "청소"]);
    expect(result.todos.map((todo) => todo.isAllDay)).toEqual([true, false]);
    expect(result.message).toBe("메모가 2개의 할 일로 변환되었습니다.");
    expect([...fixture.todoCreator.stagedTodos.values()].map((todo) => todo.title)).toEqual([
      "장보기",
      "청소",
    ]);
    expect(fixture.repository.records.has(memo.id)).toBe(false);
    expect(fixture.registeredTasks).toHaveLength(2);
  });

  it("단건·반복 혼합 결과를 순서대로 펼치며 반복 날짜·시간·하위 항목을 정규화한다", async () => {
    // Given
    const memo = fixture.addMemo("혼합 변환");
    fixture.todoCreator.recurringResult = [
      createTodoResponseFixture(
        TodoBuilder.create(fixture.userId)
          .withId(20)
          .withTitle("반복")
          .withStartDate(NOTES_TIME)
          .build(),
      ),
      createTodoResponseFixture(
        TodoBuilder.create(fixture.userId)
          .withId(21)
          .withTitle("반복")
          .withStartDate(new Date("2026-04-08T00:00:00.000Z"))
          .build(),
      ),
    ];
    const scheduledTime = new Date("2026-04-06T00:30:00.000Z");
    // When
    const result = await new ConvertMemoToTodos(fixture).execute(
      input(memo.id, [
        { title: "단건", categoryId: 1, startDate: NOTES_TIME },
        {
          title: "반복",
          categoryId: 1,
          startDate: NOTES_TIME,
          scheduledTime,
          isAllDay: false,
          items: [{ title: "운동복" }],
          isRecurring: true,
          recurrence: { daysOfWeek: ["MON", "WED"], endDate: new Date("2026-04-30T00:00:00.000Z") },
        },
      ]),
    );
    // Then
    expect(result.todos.map((todo) => todo.title)).toEqual(["단건", "반복", "반복"]);
    expect(result.message).toBe("메모가 3개의 할 일로 변환되었습니다.");
    expect(fixture.todoCreator.recurringInputs).toEqual([
      {
        data: {
          userId: fixture.userId,
          title: "반복",
          categoryId: 1,
          startDate: "2026-04-06",
          endDate: "2026-04-30",
          daysOfWeek: ["MON", "WED"],
          scheduledTime: "09:30",
          isAllDay: false,
          visibility: "PUBLIC",
          items: [{ title: "운동복" }],
        },
        timezone: "Asia/Seoul",
      },
    ]);
    expect(fixture.registeredTasks).toHaveLength(2);
    expect(fixture.repository.records.has(memo.id)).toBe(false);
  });

  it("반복 항목의 명시적 null 시간은 null로 전달하고 생략한 기본값을 유지한다", async () => {
    // Given
    const memo = fixture.addMemo("시간 없는 반복");
    const recurring = createTodoResponseFixture(
      TodoBuilder.create(fixture.userId).withId(20).withStartDate(NOTES_TIME).build(),
    );
    fixture.todoCreator.recurringResult = [recurring];
    // When
    await new ConvertMemoToTodos(fixture).execute(
      input(memo.id, [
        {
          title: "반복",
          categoryId: 1,
          startDate: NOTES_TIME,
          scheduledTime: null,
          isRecurring: true,
          recurrence: { daysOfWeek: ["MON"], endDate: NOTES_TIME },
        },
      ]),
    );
    // Then
    expect(fixture.todoCreator.recurringInputs[0]?.data).toMatchObject({
      scheduledTime: null,
      isAllDay: true,
      visibility: "PUBLIC",
    });
  });

  it("후속 항목 실패는 성공한 앞 항목의 작업만 등록하고 UoW 완료 뒤 원래 오류를 반환한다", async () => {
    // Given
    const memo = fixture.addMemo("부분 성공 대상");
    const failure = new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId: 999999 });
    const stageTodo = fixture.todoCreator.stageTodo.bind(fixture.todoCreator);
    vi.spyOn(fixture.todoCreator, "stageTodo").mockImplementation(async (data) => {
      if (data.categoryId === 999999) throw failure;
      return stageTodo(data);
    });
    const prepared = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    fixture.unitOfWork.run = async (work) => {
      const result = await work();
      prepared.resolve();
      await finish.promise;
      for (const task of fixture.registeredTasks) await task();
      return result;
    };
    let completed = false;
    // When
    const outcome = new ConvertMemoToTodos(fixture)
      .execute(
        input(memo.id, [
          { title: "성공", categoryId: 1, startDate: NOTES_TIME },
          { title: "실패", categoryId: 999999, startDate: NOTES_TIME },
          { title: "실행하지 않음", categoryId: 1, startDate: NOTES_TIME },
        ]),
      )
      .catch((error: unknown) => {
        completed = true;
        return error;
      });
    await Promise.race([
      prepared.promise,
      outcome.then(() => {
        throw new Error("Unit of Work가 대기하기 전에 변환이 종료되었습니다.");
      }),
    ]);
    // Then
    try {
      expect(completed).toBe(false);
      expect([...fixture.todoCreator.stagedTodos.values()].map((todo) => todo.title)).toEqual([
        "성공",
      ]);
      expect(fixture.repository.records.get(memo.id)).toEqual(memo);
      expect(fixture.registeredTasks).toHaveLength(1);
      expect(fixture.todoCreator.settledTodoIds).toEqual([]);
    } finally {
      finish.resolve();
    }
    expect(await outcome).toBe(failure);
    expect(fixture.todoCreator.settledTodoIds).toEqual([1]);
    expect(fixture.todoCreator.singleInputs.map((data) => data.title)).toEqual(["성공"]);
  });
});
