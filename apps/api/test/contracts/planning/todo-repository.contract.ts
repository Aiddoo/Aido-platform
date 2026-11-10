import { TodoCategoryId } from "#api/modules/planning/categories/domain/todo-category-id.vo";
import { TodoId } from "#api/modules/planning/shared/domain/todo-id.vo";
import { TodoItemId } from "#api/modules/planning/shared/domain/todo-item-id.vo";
import { TodoItem } from "#api/modules/planning/shared/domain/todo-item.entity";
import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import type { Todo, TodoPrimitives } from "#api/modules/planning/shared/domain/todo.aggregate";
import type { TodoSeriesRepositoryPort } from "#api/modules/planning/todo-series/application/ports/todo-series.repository.port";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import type {
  TodoOccurrencePlan,
  TodoRepositoryPort,
} from "#api/modules/planning/todos/application/ports/todo.repository.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createTodoSeriesFixture } from "#test/fixtures/planning/todo-series.fixture";
import {
  createTodoFixture,
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

export interface TodoRepositoryContractContext {
  readonly todoRepository: TodoRepositoryPort;
  readonly seriesRepository: TodoSeriesRepositoryPort;
  /** 두 사용자가 모두 쓸 수 있는 카테고리 */
  readonly categoryId: number;
}

const SERIES_ID = "0f9d7c1e-6a4b-4c2d-9e8f-1a2b3c4d5e6f";
const LATER = TODO_FIXTURE_NOW.add({ minutes: 1 });

async function insertTodo(
  context: TodoRepositoryContractContext,
  overrides: Partial<TodoPrimitives> = {},
): Promise<Todo> {
  const todo = createTodoFixture({
    id: (await context.todoRepository.nextId()).value,
    categoryId: context.categoryId,
    ...overrides,
  });
  await context.todoRepository.insert(todo);
  return todo;
}

async function occurrencePlans(
  context: TodoRepositoryContractContext,
  dates: readonly string[],
  sortOrderFrom = 0,
): Promise<TodoOccurrencePlan[]> {
  const ids = await context.todoRepository.nextIds(dates.length);
  return dates.flatMap((date, index) => {
    const id = ids[index];
    return id == null
      ? []
      : [
          {
            id,
            userId: TODO_FIXTURE_USER_ID,
            categoryId: context.categoryId,
            title: "물 마시기",
            visibility: "PUBLIC",
            startDate: Temporal.PlainDate.from(date),
            endDate: null,
            scheduledLocalTime: "09:00",
            scheduledTime: Temporal.Instant.from(`${date}T00:00:00.000Z`),
            isAllDay: false,
            occurrenceDate: date,
            createdAt: TODO_FIXTURE_NOW,
            sortOrder: sortOrderFrom + index,
          },
        ];
  });
}

async function findPrimitives(
  context: TodoRepositoryContractContext,
  todo: Todo,
): Promise<TodoPrimitives | undefined> {
  return (await context.todoRepository.findByIdAndUserId(todo.id, todo.userId))?.toPrimitives();
}

export function describeTodoRepositoryContract(
  createContext: () => Promise<TodoRepositoryContractContext>,
): void {
  describe("할 일 저장소 계약", () => {
    it("nextIds는 한 번에 서로 다른 id를 오름차순으로 주고 nextId와 겹치지 않는다", async () => {
      // Given
      const { todoRepository } = await createContext();

      // When
      const batch = await todoRepository.nextIds(3);
      const single = await todoRepository.nextId();

      // Then
      const values = batch.map((id) => id.value);
      expect(values).toEqual([...values].toSorted((left, right) => left - right));
      expect(new Set([...values, single.value]).size).toBe(4);
    });

    it("넣은 할 일은 주인에게만 보이고 같은 값으로 복원된다", async () => {
      // Given
      const context = await createContext();
      const todo = await insertTodo(context, {
        title: "치과 예약",
        scheduledLocalTime: "09:30",
        scheduledTime: Temporal.Instant.from("2026-11-10T00:30:00.000Z"),
        isAllDay: false,
        endDate: Temporal.PlainDate.from("2026-11-12"),
        visibility: "PRIVATE",
      });

      // When
      const found = await context.todoRepository.findByIdAndUserId(
        todo.id,
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      const foreign = await context.todoRepository.findByIdAndUserId(
        todo.id,
        UserId.reconstitute(TODO_FIXTURE_OTHER_USER_ID),
      );

      // Then
      expect(found?.toPrimitives()).toEqual(todo.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("부분 수정은 보낸 칸만 바꾸고 null은 지우기, 생략은 유지다", async () => {
      // Given
      const context = await createContext();
      const todo = await insertTodo(context, {
        endDate: Temporal.PlainDate.from("2026-11-12"),
        visibility: "PRIVATE",
      });

      // When
      await context.todoRepository.updateDetails(todo.id, {
        title: "바뀐 제목",
        endDate: null,
        completed: true,
        completedAt: LATER,
      });
      const completed = await findPrimitives(context, todo);
      await context.todoRepository.updateDetails(todo.id, {
        completed: false,
        completedAt: null,
      });
      const reopened = await findPrimitives(context, todo);

      // Then
      expect(completed).toMatchObject({
        title: "바뀐 제목",
        endDate: null,
        visibility: "PRIVATE",
        completed: true,
        completedAt: LATER,
      });
      expect(reopened).toMatchObject({ title: "바뀐 제목", completed: false, completedAt: null });
    });

    it("제목·공개·카테고리·일정·순서는 각각 그 칸만 바꾼다", async () => {
      // Given
      const context = await createContext();
      const todo = await insertTodo(context);
      const schedule = {
        startDate: Temporal.PlainDate.from("2026-11-20"),
        endDate: null,
        scheduledLocalTime: "08:00",
        scheduledTime: Temporal.Instant.from("2026-11-19T23:00:00.000Z"),
        isAllDay: false,
      };

      // When
      await context.todoRepository.updateTitle(todo.id, "새 제목");
      await context.todoRepository.updateVisibility(todo.id, "PRIVATE");
      await context.todoRepository.updateCategory(
        todo.id,
        TodoCategoryId.reconstitute(context.categoryId),
      );
      await context.todoRepository.updateSchedule(todo.id, schedule);
      await context.todoRepository.updateSortOrder(todo.id, 7);

      // Then
      expect(await findPrimitives(context, todo)).toMatchObject({
        title: "새 제목",
        visibility: "PRIVATE",
        categoryId: context.categoryId,
        sortOrder: 7,
        ...schedule,
      });
    });

    it.each([
      { name: "닫힌 구간", from: 1, to: 2, delta: 1, expected: [0, 2, 3, 3, 1] },
      { name: "끝이 열린 구간", from: 2, to: null, delta: -1, expected: [0, 1, 1, 2, 1] },
    ])(
      "$name 순서 밀기는 그 사용자 구간 안 할 일만 옮긴다",
      async ({ from, to, delta, expected }) => {
        // Given
        const context = await createContext();
        const todos: Todo[] = [];
        for (const sortOrder of [0, 1, 2, 3]) {
          todos.push(await insertTodo(context, { sortOrder }));
        }
        todos.push(await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID, sortOrder: 1 }));

        // When
        await context.todoRepository.shiftSortOrders(
          UserId.reconstitute(TODO_FIXTURE_USER_ID),
          from,
          to,
          delta,
        );

        // Then
        const sortOrders = [];
        for (const todo of todos) {
          sortOrders.push((await findPrimitives(context, todo))?.sortOrder);
        }
        expect(sortOrders).toEqual(expected);
      },
    );

    it("최대 순서는 그 사용자 할 일만 보고 없으면 -1이다", async () => {
      // Given
      const context = await createContext();
      const empty = await context.todoRepository.getMaxSortOrder(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );
      await insertTodo(context, { sortOrder: 4 });
      await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID, sortOrder: 9 });

      // When
      const maxSortOrder = await context.todoRepository.getMaxSortOrder(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
      );

      // Then
      expect({ empty, maxSortOrder }).toEqual({ empty: -1, maxSortOrder: 4 });
    });

    it("회차는 이미 있는 날짜를 건너뛰고 만든 행에만 체크리스트를 복사한다", async () => {
      // Given
      const context = await createContext();
      const [existing] = await context.todoRepository.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10"]),
        TodoSeriesId.reconstitute(SERIES_ID),
        [],
      );

      // When
      const created = await context.todoRepository.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10", "2026-11-11"], 1),
        TodoSeriesId.reconstitute(SERIES_ID),
        [{ title: "물병 채우기" }, { title: "마시기" }],
      );
      const rows = await context.todoRepository.findOccurrencesFrom(
        [TodoSeriesId.reconstitute(SERIES_ID)],
        "2026-11-10",
      );

      // Then
      expect(created).toEqual([
        expect.objectContaining({
          scheduledTime: Temporal.Instant.from("2026-11-11T00:00:00.000Z"),
        }),
      ]);
      expect(rows.map((row) => [row.todoId, row.occurrenceDate])).toEqual([
        [existing?.todoId, "2026-11-10"],
        [created[0]?.todoId, "2026-11-11"],
      ]);
      const titles = await Promise.all(
        [existing?.todoId, created[0]?.todoId].map(async (todoId) =>
          (
            await context.todoRepository.findByIdAndUserId(
              TodoId.reconstitute(todoId ?? 0),
              UserId.reconstitute(TODO_FIXTURE_USER_ID),
            )
          )
            ?.toPrimitives()
            .items.map((item) => item.title),
        ),
      );
      expect(titles).toEqual([[], ["물병 채우기", "마시기"]]);
    });

    it("회차 지우기는 기준 날짜부터이고 완료 회차는 includeCompleted일 때만 지운다", async () => {
      // Given
      const context = await createContext();
      const created = await context.todoRepository.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10", "2026-11-11", "2026-11-12"]),
        TodoSeriesId.reconstitute(SERIES_ID),
        [],
      );
      const completedId = created[2]?.todoId ?? 0;
      await context.todoRepository.updateDetails(TodoId.reconstitute(completedId), {
        completed: true,
        completedAt: LATER,
      });

      // When
      const following = await context.todoRepository.deleteOccurrences({
        userId: UserId.reconstitute(TODO_FIXTURE_USER_ID),
        seriesIds: [TodoSeriesId.reconstitute(SERIES_ID)],
        fromDate: "2026-11-11",
        includeCompleted: false,
      });
      const rest = await context.todoRepository.deleteOccurrences({
        userId: UserId.reconstitute(TODO_FIXTURE_USER_ID),
        seriesIds: [TodoSeriesId.reconstitute(SERIES_ID)],
        includeCompleted: true,
      });

      // Then
      expect(following).toEqual([created[1]?.todoId]);
      expect(rest.toSorted((left, right) => left - right)).toEqual([
        created[0]?.todoId,
        completedId,
      ]);
    });

    it("카테고리 사용량은 반복 아닌 미완료 할 일과 진행 중 규칙 하나씩을 센다", async () => {
      // Given
      const context = await createContext();
      await insertTodo(context);
      await insertTodo(context, { completed: true, completedAt: TODO_FIXTURE_NOW });
      await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID });
      await context.todoRepository.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10", "2026-11-11"]),
        TodoSeriesId.reconstitute(SERIES_ID),
        [],
      );
      await context.seriesRepository.insert(
        createTodoSeriesFixture({ id: SERIES_ID, categoryId: context.categoryId }),
      );

      // When
      const usage = await context.todoRepository.countCategoryUsage(
        UserId.reconstitute(TODO_FIXTURE_USER_ID),
        TodoCategoryId.reconstitute(context.categoryId),
      );

      // Then
      expect(usage).toBe(2);
    });

    it("하위 항목은 넣은 순서로 읽고 고치기·지우기·순서 바꾸기를 반영한다", async () => {
      // Given
      const context = await createContext();
      const todo = await insertTodo(context);
      await context.todoRepository.createInlineItems(todo.id, [
        { title: "첫째" },
        { title: "둘째" },
      ]);
      const added = TodoItem.create({
        id: await context.todoRepository.nextItemId(),
        title: TodoTitle.create("셋째"),
        sortOrder: 2,
        now: TODO_FIXTURE_NOW,
      });
      await context.todoRepository.insertItem(todo.id, added);
      const inserted = (await findPrimitives(context, todo))?.items ?? [];
      const [first, second] = inserted;

      // When
      await context.todoRepository.updateItem(TodoItemId.reconstitute(first?.id ?? 0), {
        completed: true,
      });
      await context.todoRepository.deleteItem(TodoItemId.reconstitute(second?.id ?? 0));
      await context.todoRepository.reorderItems([
        added.id,
        TodoItemId.reconstitute(first?.id ?? 0),
      ]);

      // Then
      const items = (await findPrimitives(context, todo))?.items ?? [];
      expect(inserted.map((item) => item.title)).toEqual(["첫째", "둘째", "셋째"]);
      expect(items.map((item) => [item.title, item.completed, item.sortOrder])).toEqual([
        ["셋째", false, 0],
        ["첫째", true, 1],
      ]);
      expect(TodoItemId.reconstitute(items[0]?.id ?? 0).equals(added.id)).toBe(true);
    });

    it("지운 할 일은 다시 찾을 수 없다", async () => {
      // Given
      const context = await createContext();
      const todo = await insertTodo(context);
      const kept = await insertTodo(context);

      // When
      await context.todoRepository.delete(todo.id);

      // Then
      expect(await findPrimitives(context, todo)).toBeUndefined();
      expect(await findPrimitives(context, kept)).toBeDefined();
    });
  });
}
