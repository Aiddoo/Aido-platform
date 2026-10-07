import type { Todo } from "@aido/api";
import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createMemoRepositoryMock, createTodoCreatorMock } from "#test/mocks/ports/memo.mock";

import { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { type TodoCreatorPort } from "../../ports/memos/todo-creator.port.js";
import {
  type ConvertMemoToSingleTodoData,
  type ConvertMemoToTodosInput,
  ConvertMemoToTodos,
} from "./convert-memo-to-todos.use-case.js";

// 도메인 애그리게잇 복원 헬퍼 (모듈 컨벤션: MemoBuilder는 Prisma 행이므로 reconstitute 사용)
const memoEntity = (): Memo =>
  Memo.reconstitute({
    id: 1,
    userId: "user-1",
    content: "장보기\n청소하기",
    isPinned: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const todoView = (id: number): Todo => ({
  id,
  userId: "user-1",
  title: `할 일 ${id}`,
  sortOrder: 0,
  completed: false,
  completedAt: null,
  startDate: "2026-04-06",
  endDate: null,
  scheduledTime: null,
  isAllDay: true,
  visibility: "PUBLIC",
  recurrenceGroupId: null,
  category: { id: 5, name: "기본", color: "#FFB3B3", sortOrder: 0 },
  items: [],
  itemStats: { total: 0, completed: 0 },
  commentCount: 0,
  createdAt: "2026-04-06T00:00:00.000Z",
  updatedAt: "2026-04-06T00:00:00.000Z",
});

const singleTodo = (
  overrides: Partial<ConvertMemoToSingleTodoData> = {},
): ConvertMemoToSingleTodoData => ({
  title: "장보기",
  categoryId: 5,
  startDate: new Date("2026-04-06"),
  ...overrides,
});

const input = (todos: ConvertMemoToSingleTodoData[]): ConvertMemoToTodosInput => ({
  userId: "user-1",
  memoId: 1,
  data: { todos },
  timezone: "Asia/Seoul",
});

describe("ConvertMemoToTodos — 메모→다중 할 일 일괄 변환", () => {
  let useCase: ConvertMemoToTodos;
  let repository: Mocked<MemoRepositoryPort>;
  let todoCreator: Mocked<TodoCreatorPort>;

  beforeEach(async () => {
    const convertMemoToTodosDependencies = mockDeep<
      ConstructorParameters<typeof ConvertMemoToTodos>[0]
    >({ repository: createMemoRepositoryMock(), todoCreator: createTodoCreatorMock() });
    const unit = new ConvertMemoToTodos(convertMemoToTodosDependencies);

    useCase = unit;
    repository = convertMemoToTodosDependencies.repository;
    todoCreator = convertMemoToTodosDependencies.todoCreator;
  });

  it("메모가 없으면 MEMO_2001을 던지고 생성·삭제하지 않는다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(null);

    // When & Then
    await expect(useCase.execute(input([singleTodo()]))).rejects.toMatchObject({
      errorCode: "MEMO_2001",
    });
    expect(todoCreator.createTodo).not.toHaveBeenCalled();
    expect(todoCreator.createRecurringTodos).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("단건 항목은 createTodo로 생성하고 모든 생성 후 메모를 삭제한다", async () => {
    // Given - 비반복 항목 2개
    repository.findByIdAndUserId.mockResolvedValue(memoEntity());
    todoCreator.createTodo.mockResolvedValueOnce(todoView(10)).mockResolvedValueOnce(todoView(11));

    // When
    const result = await useCase.execute(
      input([singleTodo({ title: "장보기" }), singleTodo({ title: "청소하기" })]),
    );

    // Then - createTodo 2회, 반복 경로 미사용
    expect(todoCreator.createTodo).toHaveBeenCalledTimes(2);
    expect(todoCreator.createRecurringTodos).not.toHaveBeenCalled();
    expect(todoCreator.createTodo).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: "user-1",
        title: "장보기",
        categoryId: 5,
      }),
    );
    // 메모 삭제는 마지막에 1회
    expect(repository.delete).toHaveBeenCalledTimes(1);
    expect(repository.delete).toHaveBeenCalledWith(1);
    expect(result.todos).toHaveLength(2);
    expect(result.message).toBe("메모가 2개의 할 일로 변환되었습니다.");
  });

  it("반복 항목은 createRecurringTodos로 생성하고 결과 todos를 펼쳐 담는다", async () => {
    // Given - 반복 1건이 2개의 Todo를 생성
    repository.findByIdAndUserId.mockResolvedValue(memoEntity());
    todoCreator.createRecurringTodos.mockResolvedValue({
      todos: [todoView(20), todoView(21)],
      count: 2,
    });

    // When
    const result = await useCase.execute(
      input([
        singleTodo({
          title: "운동",
          isRecurring: true,
          items: [{ title: "운동복 준비" }, { title: "스트레칭" }],
          recurrence: {
            daysOfWeek: ["MON", "WED"],
            endDate: new Date("2026-04-30"),
          },
        }),
      ]),
    );

    // Then - 반복 포트에 정규화된 날짜 문자열 + 타임존 전달
    expect(todoCreator.createRecurringTodos).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "운동",
        categoryId: 5,
        startDate: "2026-04-06",
        endDate: "2026-04-30",
        daysOfWeek: ["MON", "WED"],
        items: [{ title: "운동복 준비" }, { title: "스트레칭" }],
      }),
      "Asia/Seoul",
    );
    expect(todoCreator.createTodo).not.toHaveBeenCalled();
    expect(result.todos).toHaveLength(2);
    expect(result.message).toBe("메모가 2개의 할 일로 변환되었습니다.");
    expect(repository.delete).toHaveBeenCalledWith(1);
  });

  it("단건·반복 혼합 시 각 경로로 생성하고 메모를 1회만 삭제한다", async () => {
    // Given
    repository.findByIdAndUserId.mockResolvedValue(memoEntity());
    todoCreator.createTodo.mockResolvedValue(todoView(30));
    todoCreator.createRecurringTodos.mockResolvedValue({
      todos: [todoView(31)],
      count: 1,
    });

    // When
    const result = await useCase.execute(
      input([
        singleTodo({ title: "단건" }),
        singleTodo({
          title: "반복",
          isRecurring: true,
          recurrence: { daysOfWeek: ["FRI"], endDate: new Date("2026-05-01") },
        }),
      ]),
    );

    // Then
    expect(todoCreator.createTodo).toHaveBeenCalledTimes(1);
    expect(todoCreator.createRecurringTodos).toHaveBeenCalledTimes(1);
    expect(result.todos).toHaveLength(2);
    expect(repository.delete).toHaveBeenCalledTimes(1);
  });

  it("중간 항목 생성 실패 시 예외를 전파하고 메모를 삭제하지 않는다 (재시도 가능)", async () => {
    // Given - 첫 항목은 성공, 두 번째에서 실패
    repository.findByIdAndUserId.mockResolvedValue(memoEntity());
    todoCreator.createTodo
      .mockResolvedValueOnce(todoView(40))
      .mockRejectedValueOnce(new Error("todo 생성 실패"));

    // When & Then
    await expect(
      useCase.execute(input([singleTodo({ title: "먼저" }), singleTodo({ title: "실패" })])),
    ).rejects.toThrow("todo 생성 실패");

    // 이미 생성된 첫 Todo는 롤백하지 않고, 메모는 유지되어 재시도 가능
    expect(todoCreator.createTodo).toHaveBeenCalledTimes(2);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
