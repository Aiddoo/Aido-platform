import { ErrorCode } from "@aido/api/errors";

import { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createPlanningTodoFixture,
  createPlanningTodo,
} from "#test/fixtures/planning/planning-todos.fixture";
import { createTodoReadModelFromRecord } from "#test/fixtures/planning/todo-response.fixture";

import { ListTodosUseCase } from "./list-todos.use-case.js";

describe("할 일 목록 조회", () => {
  let fixture: ReturnType<typeof createPlanningTodoFixture>;
  let useCase: ListTodosUseCase;
  beforeEach(() => {
    fixture = createPlanningTodoFixture({ todos: [createPlanningTodo()] });
    useCase = new ListTodosUseCase(fixture);
  });

  it("복귀 처리가 끝난 뒤 목록을 읽는다", async () => {
    // Given
    fixture.seriesCatchUp.execute = async () => {
      fixture.todoReadRepository.queryResults = [
        createTodoReadModelFromRecord(createPlanningTodo(fixture.userId, 7)),
      ];
    };
    // When
    const page = await useCase.execute({ userId: fixture.userId });
    // Then
    expect(page.items.map((todo) => todo.id)).toEqual([7]);
  });

  it("필터와 정규화한 size를 읽기 경계에 전달한다", async () => {
    // Given
    const startDate = Temporal.PlainDate.from("2026-05-01");
    const endDate = Temporal.PlainDate.from("2026-05-31");
    // When
    await useCase.execute({
      userId: fixture.userId,
      cursor: 5,
      size: 10,
      categoryId: 1,
      completed: false,
      startDate,
      endDate,
    });
    // Then
    expect(fixture.todoReadRepository.listQueries).toEqual([
      {
        userId: UserId.reconstitute(fixture.userId),
        cursor: 5,
        size: 10,
        categoryId: TodoCategoryId.reconstitute(1),
        completed: false,
        startDate,
        endDate,
      },
    ]);
  });
  it("size+1 결과에서 다음 커서를 만들고 마지막 페이지는 null을 반환한다", async () => {
    // Given
    fixture.todoReadRepository.queryResults = [3, 2, 1].map((id) =>
      createTodoReadModelFromRecord(createPlanningTodo(fixture.userId, id)),
    );
    // When
    const first = await useCase.execute({ userId: fixture.userId, size: 2 });
    fixture.todoReadRepository.queryResults = [
      createTodoReadModelFromRecord(createPlanningTodo(fixture.userId, 1)),
    ];
    const last = await useCase.execute({ userId: fixture.userId, cursor: 2, size: 2 });
    // Then
    expect(first.items.map((todo) => todo.id)).toEqual([3, 2]);
    expect(first.pagination).toEqual({ nextCursor: 2, hasNext: true, size: 2 });
    expect(last.pagination).toEqual({ nextCursor: null, hasNext: false, size: 2 });
  });
  it("size 생략은 기본20이며 날짜가 같거나 끝이 생략되어도 유효하다", async () => {
    // Given
    const today = Temporal.PlainDate.from("2026-05-15");
    // When
    const sameDay = await useCase.execute({
      userId: fixture.userId,
      startDate: today,
      endDate: today,
    });
    const openRange = await useCase.execute({ userId: fixture.userId, startDate: today });
    // Then
    expect(sameDay.pagination).toEqual({ nextCursor: null, hasNext: false, size: 20 });
    expect(openRange.pagination.size).toBe(20);
  });
  it("역전된 기간은 저장소에 도달하기 전에 거부한다", async () => {
    // When
    const result = useCase.execute({
      userId: fixture.userId,
      startDate: Temporal.PlainDate.from("2026-05-16"),
      endDate: Temporal.PlainDate.from("2026-05-15"),
    });
    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(fixture.todoReadRepository.listQueries).toEqual([]);
  });
});
