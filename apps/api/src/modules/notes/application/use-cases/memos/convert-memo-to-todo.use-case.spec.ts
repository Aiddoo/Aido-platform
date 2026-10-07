import type { Todo } from "@aido/api";
import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { Memo } from "../../../domain/aggregates/memos/memo.aggregate.js";
import { type MemoRepositoryPort } from "../../ports/memos/memo.repository.port.js";
import { type TodoCreatorPort } from "../../ports/memos/todo-creator.port.js";
import { type ConvertMemoToTodoInput, ConvertMemoToTodo } from "./convert-memo-to-todo.use-case.js";

const memoEntity = (content: string): Memo =>
  Memo.reconstitute({
    id: 1,
    userId: "user-1",
    content,
    isPinned: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const todoView = (id: number): Todo => ({
  id,
  userId: "clz7x5p8k0010qz0z8z8z8z8z",
  title: "새 할 일",
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

const input = (): ConvertMemoToTodoInput => ({
  userId: "user-1",
  memoId: 1,
  data: {
    categoryId: 5,
    startDate: new Date("2026-04-06"),
  },
});

describe("ConvertMemoToTodo — 메모→할 일 변환", () => {
  let useCase: ConvertMemoToTodo;
  let repository: Mocked<MemoRepositoryPort>;
  let todoCreator: Mocked<TodoCreatorPort>;

  beforeEach(async () => {
    const convertMemoToTodoDependencies = mockDeep<
      ConstructorParameters<typeof ConvertMemoToTodo>[0]
    >({
      todoCreator: {
        createTodo: vi.fn(),
        createRecurringTodos: vi.fn(),
      },
    });
    const unit = new ConvertMemoToTodo(convertMemoToTodoDependencies);
    useCase = unit;
    repository = convertMemoToTodoDependencies.repository;
    todoCreator = convertMemoToTodoDependencies.todoCreator;
  });

  it("메모가 없으면 MEMO_2001을 던진다", async () => {
    repository.findByIdAndUserId.mockResolvedValue(null);

    await expect(useCase.execute(input())).rejects.toMatchObject({
      errorCode: "MEMO_2001",
    });
    expect(todoCreator.createTodo).not.toHaveBeenCalled();
  });

  it("제목을 200자로 축약해 todo 생성 포트를 호출하고 메모를 삭제한다", async () => {
    repository.findByIdAndUserId.mockResolvedValue(memoEntity("x".repeat(300)));
    todoCreator.createTodo.mockResolvedValue(todoView(10));

    const result = await useCase.execute(input());

    expect(todoCreator.createTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "x".repeat(200),
        categoryId: 5,
      }),
    );
    expect(repository.delete).toHaveBeenCalledWith(1);
    expect(result.message).toBe("메모가 할 일로 변환되었습니다.");
  });
});
