import { zip } from "es-toolkit";

import { TodoTitle } from "#api/modules/planning/shared/domain/todo-title.vo";
import { TodoCategoryId } from "#api/modules/planning/todo-categories/domain/todo-category-id.vo";
import type { TodoSeriesRepositoryPort } from "#api/modules/planning/todo-series/application/ports/todo-series.repository.port";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import type {
  TodoOccurrencePlan,
  TodoOccurrenceWriterPort,
} from "#api/modules/planning/todos/application/ports/todo-occurrence-writer.port";
import type { TodoRepositoryPort } from "#api/modules/planning/todos/application/ports/todo.repository.port";
import { TodoId } from "#api/modules/planning/todos/domain/todo-id.vo";
import { TodoItemId } from "#api/modules/planning/todos/domain/todo-item-id.vo";
import { TodoSchedule } from "#api/modules/planning/todos/domain/todo-schedule.vo";
import type { Todo, TodoPrimitives } from "#api/modules/planning/todos/domain/todo.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createTodoSeriesFixture } from "#test/fixtures/planning/todo-series.fixture";
import {
  createTodoFixture,
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

export interface TodoEngagementCounts {
  readonly commentCount: number;
  readonly viewCount: number;
}

export interface TodoRepositoryContractContext {
  readonly todoRepository: TodoRepositoryPort;
  readonly occurrenceWriter: TodoOccurrenceWriterPort;
  readonly seriesRepository: TodoSeriesRepositoryPort;
  // 두 사용자가 모두 쓸 수 있는 카테고리
  readonly categoryId: number;
  // engagement가 TodoEngagementCounterPort로 쓰는 칸을 저장소 밖에서 바꾸고 읽는다
  readonly engagementCounts: {
    write(todoId: TodoId, counts: TodoEngagementCounts): Promise<void>;
    read(todoId: TodoId): Promise<TodoEngagementCounts>;
  };
}

const SERIES_ID = "0f9d7c1e-6a4b-4c2d-9e8f-1a2b3c4d5e6f";
const LATER = TODO_FIXTURE_NOW.add({ minutes: 1 });
const OWNER_ID = UserId.reconstitute(TODO_FIXTURE_USER_ID);

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
  const ids = await context.occurrenceWriter.nextIds(dates.length);
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
            occurrenceDate: Temporal.PlainDate.from(date),
            createdAt: TODO_FIXTURE_NOW,
            sortOrder: sortOrderFrom + index,
          },
        ];
  });
}

async function load(context: TodoRepositoryContractContext, todo: Todo): Promise<Todo> {
  const found = await context.todoRepository.findByIdAndUserId(todo.id, todo.userId);
  if (found == null) {
    throw new Error("저장한 할 일을 다시 읽지 못했다");
  }
  return found;
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
    it("회차 id 묶음은 한 번에 서로 다른 id를 오름차순으로 주고 nextId와 겹치지 않는다", async () => {
      // Given
      const { todoRepository, occurrenceWriter } = await createContext();

      // When
      const batch = await occurrenceWriter.nextIds(3);
      const single = await todoRepository.nextId();

      // Then
      const values = batch.map((id) => id.value);
      expect(values).toEqual([...values].toSorted((left, right) => left - right));
      expect(new Set([...values, single.value]).size).toBe(4);
    });

    it("넣은 할 일은 주인에게만 보이고 읽기·잠가 읽기 모두 같은 값으로 복원된다", async () => {
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
      const found = await context.todoRepository.findByIdAndUserId(todo.id, OWNER_ID);
      const locked = await context.todoRepository.lockByIdAndUserId(todo.id, OWNER_ID);
      const foreign = await context.todoRepository.lockByIdAndUserId(
        todo.id,
        UserId.reconstitute(TODO_FIXTURE_OTHER_USER_ID),
      );

      // Then
      expect(found?.toPrimitives()).toEqual(todo.toPrimitives());
      expect(locked?.toPrimitives()).toEqual(todo.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("save는 행동이 바꾼 Aggregate 칸을 모두 쓰고 다시 읽으면 같은 값이다", async () => {
      // Given
      const context = await createContext();
      const inserted = await insertTodo(context, {
        endDate: Temporal.PlainDate.from("2026-11-12"),
        visibility: "PRIVATE",
      });
      const todo = await load(context, inserted);

      // When
      todo.updateDetails(
        { title: "바뀐 제목", endDate: null, visibility: "PUBLIC", completed: true },
        "Asia/Seoul",
        LATER,
      );
      todo.moveTo(7, LATER);
      todo.reschedule(
        TodoSchedule.create({
          startDate: Temporal.PlainDate.from("2026-11-20"),
          endDate: null,
          scheduledLocalTime: "08:00",
          isAllDay: false,
          timezone: "Asia/Seoul",
        }),
        LATER,
      );
      await context.todoRepository.save(todo);

      // Then
      expect(await findPrimitives(context, todo)).toEqual(todo.toPrimitives());
      expect(todo.toPrimitives()).toMatchObject({
        title: "바뀐 제목",
        endDate: null,
        visibility: "PUBLIC",
        completed: true,
        completedAt: LATER,
        sortOrder: 7,
        scheduledLocalTime: "08:00",
        updatedAt: LATER,
      });
    });

    it("save는 engagement가 고친 댓글·조회 수를 덮어쓰지 않는다", async () => {
      // Given: 할 일을 읽은 뒤 다른 요청이 댓글·조회 수를 바꿨다
      const context = await createContext();
      const todo = await load(context, await insertTodo(context));
      await context.engagementCounts.write(todo.id, { commentCount: 3, viewCount: 7 });

      // When
      todo.rename(TodoTitle.create("댓글 달린 할 일"), LATER);
      todo.complete("Asia/Seoul", LATER);
      await context.todoRepository.save(todo);

      // Then
      expect(await context.engagementCounts.read(todo.id)).toEqual({
        commentCount: 3,
        viewCount: 7,
      });
      expect(await findPrimitives(context, todo)).toMatchObject({
        title: "댓글 달린 할 일",
        completed: true,
      });
    });

    it("지운 할 일을 save하면 부재 오류이고 행을 되살리지 않는다", async () => {
      // Given
      const context = await createContext();
      const todo = await load(context, await insertTodo(context));
      await context.todoRepository.delete(todo);

      // When
      todo.rename(TodoTitle.create("늦게 온 수정"), LATER);
      const save = context.todoRepository.save(todo);

      // Then
      await expect(save).rejects.toThrow();
      expect(await findPrimitives(context, todo)).toBeUndefined();
    });

    it("공개 범위만 바꿔 저장하면 다른 칸은 그대로다", async () => {
      // Given
      const context = await createContext();
      const todo = await load(
        context,
        await insertTodo(context, { categoryId: context.categoryId }),
      );
      const before = todo.toPrimitives();

      // When
      todo.changeVisibility("PRIVATE", LATER);
      await context.todoRepository.save(todo);

      // Then
      expect(await findPrimitives(context, todo)).toEqual({
        ...before,
        visibility: "PRIVATE",
        updatedAt: LATER,
      });
      expect(todo.categoryId.equals(TodoCategoryId.reconstitute(context.categoryId))).toBe(true);
    });

    it("이웃·끝 순서는 그 사용자 할 일을 (sortOrder, id)로 보고 옮기는 할 일은 건너뛴다", async () => {
      // Given: 같은 sortOrder 둘(20)은 id 순서로 줄 선다
      const context = await createContext();
      const first = await insertTodo(context, { sortOrder: 10 });
      const tieLow = await insertTodo(context, { sortOrder: 20 });
      const tieHigh = await insertTodo(context, { sortOrder: 20 });
      const last = await insertTodo(context, { sortOrder: 30 });
      await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID, sortOrder: 25 });
      const at = (todo: Todo) => ({ id: todo.id, sortOrder: todo.sortOrder });

      // When
      const { todoRepository } = context;
      const neighbors = {
        afterTieLow: await todoRepository.findAdjacentSortOrder(OWNER_ID, {
          from: at(tieLow),
          direction: "next",
          excludeId: first.id,
        }),
        afterTieLowSkippingTieHigh: await todoRepository.findAdjacentSortOrder(OWNER_ID, {
          from: at(tieLow),
          direction: "next",
          excludeId: tieHigh.id,
        }),
        beforeFirst: await todoRepository.findAdjacentSortOrder(OWNER_ID, {
          from: at(first),
          direction: "previous",
          excludeId: last.id,
        }),
        firstSkippingFirst: await todoRepository.findEdgeSortOrder(OWNER_ID, "first", first.id),
        lastSkippingLast: await todoRepository.findEdgeSortOrder(OWNER_ID, "last", last.id),
      };

      // Then
      expect(neighbors).toEqual({
        afterTieLow: 20,
        afterTieLowSkippingTieHigh: 30,
        beforeFirst: null,
        firstSkippingFirst: 20,
        lastSkippingLast: 20,
      });
    });

    it("다시 번호 매김은 그 사용자 할 일만 지금 순서대로 간격을 둔다", async () => {
      // Given
      const context = await createContext();
      const todos: Todo[] = [];
      for (const sortOrder of [5, 3, 3, 4]) {
        todos.push(await insertTodo(context, { sortOrder }));
      }
      const other = await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID, sortOrder: 1 });

      // When
      await context.todoRepository.renumberSortOrders(OWNER_ID);

      // Then: (3, 앞 id) → (3, 뒤 id) → 4 → 5 순서다
      const sortOrders = [];
      for (const todo of [...todos, other]) {
        sortOrders.push((await findPrimitives(context, todo))?.sortOrder);
      }
      expect(sortOrders).toEqual([4096, 1024, 2048, 3072, 1]);
    });

    it("최대 순서는 그 사용자 할 일만 보고 없으면 -1이다", async () => {
      // Given
      const context = await createContext();
      const empty = await context.todoRepository.getMaxSortOrder(OWNER_ID);
      await insertTodo(context, { sortOrder: 4 });
      await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID, sortOrder: 9 });

      // When
      const maxSortOrder = await context.todoRepository.getMaxSortOrder(OWNER_ID);

      // Then
      expect({ empty, maxSortOrder }).toEqual({ empty: -1, maxSortOrder: 4 });
    });

    it("회차는 이미 있는 날짜를 건너뛰고 만든 행에만 체크리스트를 복사한다", async () => {
      // Given
      const context = await createContext();
      const seriesId = TodoSeriesId.reconstitute(SERIES_ID);
      const [existing] = await context.occurrenceWriter.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10"]),
        seriesId,
        [],
      );

      // When
      const created = await context.occurrenceWriter.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10", "2026-11-11"], 1),
        seriesId,
        [{ title: "물병 채우기" }, { title: "마시기" }],
      );
      const rows = await context.occurrenceWriter.listOccurrencesFrom([seriesId], "2026-11-10");

      // Then
      expect(created).toEqual([
        expect.objectContaining({
          scheduledTime: Temporal.Instant.from("2026-11-11T00:00:00.000Z"),
        }),
      ]);
      expect(rows.map((row) => [row.todoId, row.occurrenceDate])).toEqual([
        [existing?.todoId.value, "2026-11-10"],
        [created[0]?.todoId.value, "2026-11-11"],
      ]);
      const titles = await Promise.all(
        [existing?.todoId.value, created[0]?.todoId.value].map(async (todoId) =>
          (
            await context.todoRepository.findByIdAndUserId(
              TodoId.reconstitute(todoId ?? 0),
              OWNER_ID,
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
      const seriesId = TodoSeriesId.reconstitute(SERIES_ID);
      const created = await context.occurrenceWriter.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10", "2026-11-11", "2026-11-12"]),
        seriesId,
        [],
      );
      const completedId = created[2]?.todoId.value ?? 0;
      const completed = await context.todoRepository.findByIdAndUserId(
        TodoId.reconstitute(completedId),
        OWNER_ID,
      );
      completed?.complete("Asia/Seoul", LATER);
      if (completed != null) {
        await context.todoRepository.save(completed);
      }

      // When
      const following = await context.occurrenceWriter.deleteOccurrences({
        userId: OWNER_ID,
        seriesIds: [seriesId],
        fromDate: "2026-11-11",
        includeCompleted: false,
      });
      const rest = await context.occurrenceWriter.deleteOccurrences({
        userId: OWNER_ID,
        seriesIds: [seriesId],
        includeCompleted: true,
      });

      // Then
      expect(following).toEqual([created[1]?.todoId.value]);
      expect(rest.toSorted((left, right) => left - right)).toEqual([
        created[0]?.todoId.value,
        completedId,
      ]);
    });

    it("카테고리 사용량은 반복 아닌 미완료 할 일과 진행 중 규칙 하나씩을 센다", async () => {
      // Given
      const context = await createContext();
      await insertTodo(context);
      await insertTodo(context, { completed: true, completedAt: TODO_FIXTURE_NOW });
      await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID });
      await context.occurrenceWriter.insertOccurrences(
        await occurrencePlans(context, ["2026-11-10", "2026-11-11"]),
        TodoSeriesId.reconstitute(SERIES_ID),
        [],
      );
      await context.seriesRepository.insert(
        createTodoSeriesFixture({ id: SERIES_ID, categoryId: context.categoryId }),
      );

      // When
      const usage = await context.todoRepository.countCategoryUsage(
        OWNER_ID,
        TodoCategoryId.reconstitute(context.categoryId),
      );

      // Then
      expect(usage).toBe(2);
    });

    it("카테고리별 사용량은 단건 사용량과 같은 기준이고 넘긴 카테고리는 할 일이 없어도 0으로 준다", async () => {
      // Given
      const context = await createContext();
      await insertTodo(context);
      await insertTodo(context);
      await insertTodo(context, { completed: true, completedAt: TODO_FIXTURE_NOW });
      await insertTodo(context, { userId: TODO_FIXTURE_OTHER_USER_ID });
      await context.seriesRepository.insert(
        createTodoSeriesFixture({ id: SERIES_ID, categoryId: context.categoryId }),
      );
      const categoryId = TodoCategoryId.reconstitute(context.categoryId);
      const emptyCategoryId = TodoCategoryId.reconstitute(context.categoryId + 1000);

      // When
      const usages = await context.todoRepository.countCategoryUsages(OWNER_ID, [
        categoryId,
        emptyCategoryId,
      ]);
      const single = await context.todoRepository.countCategoryUsage(OWNER_ID, categoryId);

      // Then
      expect([...usages]).toEqual([
        [categoryId.value, 3],
        [emptyCategoryId.value, 0],
      ]);
      expect(single).toBe(3);
    });

    it("여러 새 할 일을 한 번에 넣으면 각자 같은 값으로 다시 읽힌다", async () => {
      // Given
      const { todoRepository, occurrenceWriter, categoryId } = await createContext();
      const overrides: Partial<TodoPrimitives>[] = [
        { title: "첫째", sortOrder: 1024 },
        {
          title: "둘째",
          sortOrder: 2048,
          startDate: Temporal.PlainDate.from("2026-11-12"),
          scheduledLocalTime: "09:00",
          scheduledTime: Temporal.Instant.from("2026-11-12T00:00:00Z"),
          isAllDay: false,
          visibility: "PRIVATE",
        },
      ];
      const ids = await occurrenceWriter.nextIds(overrides.length);
      const todos = zip(ids, overrides).map(([id, override]) =>
        createTodoFixture({ ...override, id: id.value, categoryId }),
      );

      // When
      await todoRepository.insertMany(todos);
      await todoRepository.insertMany([]);

      // Then
      for (const todo of todos) {
        expect((await todoRepository.findByIdAndUserId(todo.id, OWNER_ID))?.toPrimitives()).toEqual(
          todo.toPrimitives(),
        );
      }
    });

    it("하위 항목은 넣은 순서로 읽고 save가 더하기·고치기·지우기·순서 바꾸기를 반영한다", async () => {
      // Given
      const context = await createContext();
      const inserted = await insertTodo(context);
      await context.todoRepository.createInlineItems(inserted.id, [
        { title: "첫째" },
        { title: "둘째" },
      ]);
      const todo = await load(context, inserted);
      const [first, second] = todo.items;

      // When
      const added = todo.addItem({
        id: await context.todoRepository.nextItemId(),
        title: TodoTitle.create("셋째"),
        timezone: "Asia/Seoul",
        now: TODO_FIXTURE_NOW,
      });
      todo.updateItem(first?.id ?? TodoItemId.reconstitute(0), { completed: true }, LATER);
      todo.removeItem(second?.id ?? TodoItemId.reconstitute(0));
      todo.reorderItems([added.id, first?.id ?? TodoItemId.reconstitute(0)], LATER);
      await context.todoRepository.save(todo);

      // Then
      const items = (await findPrimitives(context, todo))?.items ?? [];
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
      await context.todoRepository.delete(todo);

      // Then
      expect(await findPrimitives(context, todo)).toBeUndefined();
      expect(await findPrimitives(context, kept)).toBeDefined();
    });
  });
}
