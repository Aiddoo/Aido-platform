import { ErrorCode } from "@aido/api/errors";

import type { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { RemoveCategoryTodosUseCase } from "#api/modules/planning/todos/application/use-cases/remove-category-todos.use-case";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { FakeTodoCategoryCache } from "#test/doubles/planning/fake-todo-category-cache";
import { InMemoryTodoBulkRemover } from "#test/doubles/planning/in-memory-todo-bulk-remover";
import {
  type InMemoryPlanningStores,
  InMemoryTodoCategoryRepository,
} from "#test/doubles/planning/in-memory-todo-category.repository";
import { RecordingDomainEventPublisher } from "#test/doubles/planning/recording-domain-event-publisher";
import { RecordingTodoReminderScheduler } from "#test/doubles/planning/recording-todo-reminder-scheduler";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createPlanningTodo } from "#test/fixtures/planning/planning-todos.fixture";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";
import { createTodoSeriesFixture } from "#test/fixtures/planning/todo-series.fixture";
import { TODO_FIXTURE_NOW, TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";
import type { PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";

import { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import { DeleteTodoCategoryUseCase } from "./delete-todo-category.use-case.js";

const USER_ID = TODO_FIXTURE_USER_ID;

function todoIn(
  id: number,
  categoryId: number,
  overrides: Partial<Pick<PlanningTodoRecord, "scheduledTime" | "completed">> = {},
): PlanningTodoRecord {
  return { ...createPlanningTodo(USER_ID, id), categoryId, ...overrides };
}

function setUp(
  input: {
    readonly categoryIds?: readonly number[];
    readonly todos?: readonly PlanningTodoRecord[];
    readonly series?: readonly TodoSeries[];
    readonly repository?: (stores: InMemoryPlanningStores) => InMemoryTodoCategoryRepository;
    readonly cache?: FakeTodoCategoryCache;
    readonly mutationLock?: RecordingMutationLock;
    readonly unitOfWork?: ImmediateUnitOfWork;
  } = {},
) {
  const categories = (input.categoryIds ?? [1, 2]).map((id) =>
    createTodoCategoryFixture({ id, name: `카테고리 ${id}`, sortOrder: id - 1 }),
  );
  const todoRecords = new Map((input.todos ?? []).map((record) => [record.id, record]));
  const seriesStore = new Map((input.series ?? []).map((series) => [series.id.value, series]));
  const stores = { todoRecords, seriesStore };
  const repository =
    input.repository?.(stores) ?? new InMemoryTodoCategoryRepository(categories, stores);
  const cache = input.cache ?? new FakeTodoCategoryCache();
  const eventPublisher = new RecordingDomainEventPublisher();
  const mutationLock = input.mutationLock ?? new RecordingMutationLock();
  const reminderScheduler = new RecordingTodoReminderScheduler();
  const useCase = new DeleteTodoCategoryUseCase({
    repository,
    categoryTodos: new RemoveCategoryTodosUseCase({
      bulkRemover: new InMemoryTodoBulkRemover(stores),
      reminderScheduler,
      todoCache: new FakeTodoCache(),
      afterCommit: new RecordingAfterCommitRegistry(),
    }),
    cache,
    mutationLock,
    unitOfWork: input.unitOfWork ?? new ImmediateUnitOfWork(),
    clock: new FixedClock(TODO_FIXTURE_NOW),
    eventPublisher,
    logger: new SilentLogger(),
  });
  return {
    repository,
    todoRecords,
    seriesStore,
    cache,
    eventPublisher,
    mutationLock,
    reminderScheduler,
    useCase,
  };
}

function categoryIdsOf(todoRecords: ReadonlyMap<number, PlanningTodoRecord>): number[] {
  return [...todoRecords.values()].map((record) => record.categoryId);
}

describe("카테고리 삭제", () => {
  it.each([
    {
      name: "존재하지 않으면 TODO_CATEGORY_0851",
      categoryIds: [1, 2],
      todos: [],
      command: { categoryId: 9 },
      error: { errorCode: ErrorCode.TODO_CATEGORY_0851, details: { categoryId: 9 } },
    },
    {
      name: "마지막 카테고리면 TODO_CATEGORY_0854",
      categoryIds: [1],
      todos: [],
      command: { categoryId: 1 },
      error: { errorCode: ErrorCode.TODO_CATEGORY_0854 },
    },
    {
      name: "함께 지우기를 골라도 마지막 카테고리면 TODO_CATEGORY_0854",
      categoryIds: [1],
      todos: [todoIn(10, 1)],
      command: { categoryId: 1, todoHandling: "delete" as const },
      error: { errorCode: ErrorCode.TODO_CATEGORY_0854 },
    },
    {
      name: "할 일이 있는데 이동 대상 없으면 TODO_CATEGORY_0855",
      categoryIds: [1, 2],
      todos: [todoIn(10, 1)],
      command: { categoryId: 1 },
      error: { errorCode: ErrorCode.TODO_CATEGORY_0855, details: { categoryId: 1, todoCount: 1 } },
    },
    {
      name: "이동 대상이 자신과 같으면 SYS_0002",
      categoryIds: [1, 2],
      todos: [todoIn(10, 1)],
      command: { categoryId: 1, moveToCategoryId: 1 },
      error: {
        errorCode: ErrorCode.SYS_0002,
        details: {
          message: "삭제할 카테고리와 이동 대상 카테고리가 같을 수 없습니다",
          categoryId: 1,
          moveToCategoryId: 1,
        },
      },
    },
    {
      name: "함께 지우기에 이동 대상이 있으면 SYS_0002",
      categoryIds: [1, 2],
      todos: [todoIn(10, 1)],
      command: { categoryId: 1, moveToCategoryId: 2, todoHandling: "delete" as const },
      error: { errorCode: ErrorCode.SYS_0002 },
    },
    {
      name: "이동 대상이 없으면 TODO_CATEGORY_0851",
      categoryIds: [1, 2],
      todos: [todoIn(10, 1)],
      command: { categoryId: 1, moveToCategoryId: 9, todoHandling: "move" as const },
      error: { errorCode: ErrorCode.TODO_CATEGORY_0851, details: { categoryId: 9 } },
    },
  ])("$name이고 아무것도 바꾸지 않는다", async ({ categoryIds, todos, command, error }) => {
    // Given
    const { repository, todoRecords, cache, eventPublisher, useCase } = setUp({
      categoryIds,
      todos,
    });

    // When
    const deletion = useCase.execute({ userId: USER_ID, ...command });

    // Then
    await expect(deletion).rejects.toMatchObject(error);
    expect(await repository.countByUserId(UserId.reconstitute(USER_ID))).toBe(categoryIds.length);
    expect(categoryIdsOf(todoRecords)).toEqual(todos.map((record) => record.categoryId));
    expect(cache.invalidatedUserIds).toEqual([]);
    expect(eventPublisher.publishedEvents).toEqual([]);
  });

  it("할 일 없이 진행 중 규칙만 있어도 옮길 곳을 묻고 상세에는 할 일 수만 싣는다", async () => {
    // Given
    const { repository, useCase } = setUp({
      series: [createTodoSeriesFixture({ categoryId: 1 })],
    });

    // When
    const deletion = useCase.execute({ userId: USER_ID, categoryId: 1 });

    // Then
    await expect(deletion).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0855,
      details: { categoryId: 1, todoCount: 0 },
    });
    expect(
      await repository.findByIdAndUserId(
        TodoCategoryId.reconstitute(1),
        UserId.reconstitute(USER_ID),
      ),
    ).not.toBeNull();
  });

  it.each([
    { name: "출시 앱 요청", todoHandling: undefined },
    { name: "move", todoHandling: "move" as const },
  ])("$name은 할 일과 반복 규칙을 대상 카테고리로 옮긴 뒤 삭제한다", async ({ todoHandling }) => {
    // Given
    const { repository, todoRecords, seriesStore, cache, eventPublisher, useCase } = setUp({
      todos: [todoIn(10, 1), todoIn(11, 1, { completed: true }), todoIn(12, 1)],
      series: [createTodoSeriesFixture({ categoryId: 1 })],
    });

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      categoryId: 1,
      moveToCategoryId: 2,
      todoHandling,
    });

    // Then
    expect(result).toEqual({
      todoHandling: "move",
      todoCount: 3,
      seriesCount: 1,
      moveToCategoryId: 2,
    });
    expect(
      await repository.findByIdAndUserId(
        TodoCategoryId.reconstitute(1),
        UserId.reconstitute(USER_ID),
      ),
    ).toBeNull();
    expect(categoryIdsOf(todoRecords)).toEqual([2, 2, 2]);
    expect([...seriesStore.values()].map((series) => series.categoryId)).toEqual([2]);
    expect(cache.invalidatedUserIds).toEqual([USER_ID]);
    expect(
      eventPublisher.publishedEvents.map((event) => [event.eventName, event.toPayload()]),
    ).toEqual([
      [
        "planning.todo-category.deleted",
        { categoryId: 1, userId: USER_ID, occurredAt: "2026-11-10T00:00:00.000Z" },
      ],
    ]);
  });

  it("delete는 할 일·반복 규칙을 함께 지우고 리마인더를 취소하며 카테고리 삭제 사실 하나만 낸다", async () => {
    // Given
    const { repository, todoRecords, seriesStore, eventPublisher, reminderScheduler, useCase } =
      setUp({
        todos: [
          todoIn(10, 1, { scheduledTime: TODO_FIXTURE_NOW.add({ hours: 3 }) }),
          todoIn(11, 1, { completed: true }),
          todoIn(12, 2, { scheduledTime: TODO_FIXTURE_NOW.add({ hours: 3 }) }),
        ],
        series: [createTodoSeriesFixture({ categoryId: 1 })],
      });

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      categoryId: 1,
      todoHandling: "delete",
    });

    // Then
    expect(result).toEqual({
      todoHandling: "delete",
      todoCount: 2,
      seriesCount: 1,
      moveToCategoryId: null,
    });
    expect(
      await repository.findByIdAndUserId(
        TodoCategoryId.reconstitute(1),
        UserId.reconstitute(USER_ID),
      ),
    ).toBeNull();
    expect([...todoRecords.keys()]).toEqual([12]);
    expect(seriesStore.size).toBe(0);
    expect(reminderScheduler.cancelled).toEqual([10]);
    expect(eventPublisher.publishedEvents.map((event) => event.eventName)).toEqual([
      "planning.todo-category.deleted",
    ]);
  });

  it.each([
    { name: "출시 앱 요청", command: {} },
    { name: "delete", command: { todoHandling: "delete" as const } },
    { name: "move", command: { todoHandling: "move" as const, moveToCategoryId: 9 } },
  ])("할 일이 없으면 $name도 옮길 곳을 보지 않고 바로 삭제한다", async ({ command }) => {
    // Given
    const { repository, useCase } = setUp();

    // When
    const result = await useCase.execute({ userId: USER_ID, categoryId: 1, ...command });

    // Then
    expect(result).toEqual({
      todoHandling: "none",
      todoCount: 0,
      seriesCount: 0,
      moveToCategoryId: null,
    });
    expect(
      await repository.findByIdAndUserId(
        TodoCategoryId.reconstitute(1),
        UserId.reconstitute(USER_ID),
      ),
    ).toBeNull();
    expect(await repository.countByUserId(UserId.reconstitute(USER_ID))).toBe(1);
  });

  it("사용자 카테고리·정렬 키를 UoW 안에서 첫 구조 읽기 전에 잠그고 UoW callback 성공 후 캐시를 무효화한다", async () => {
    // Given - 삭제 transaction 경계와 구조 읽기 순서 기록
    const events: string[] = [];
    class OrderedUnitOfWork extends ImmediateUnitOfWork {
      override async run<T>(work: () => Promise<T>): Promise<T> {
        events.push("uow:start");
        const result = await work();
        events.push("uow:resolved");
        return result;
      }
    }
    class OrderedMutationLock extends RecordingMutationLock {
      override async acquire(keys: readonly string[]): Promise<void> {
        events.push("lock");
        await super.acquire(keys);
      }
    }
    class OrderedRepository extends InMemoryTodoCategoryRepository {
      override async findByIdAndUserId(id: TodoCategoryId, userId: UserId) {
        events.push("category-read");
        return super.findByIdAndUserId(id, userId);
      }
      override async countByUserId(userId: UserId): Promise<number> {
        events.push("count");
        return super.countByUserId(userId);
      }
      override async countTodos(...args: Parameters<InMemoryTodoCategoryRepository["countTodos"]>) {
        events.push("todo-count");
        return super.countTodos(...args);
      }
      override async countActiveSeries(categoryId: TodoCategoryId): Promise<number> {
        events.push("active-series");
        return super.countActiveSeries(categoryId);
      }
      override async delete(id: TodoCategoryId): Promise<void> {
        events.push("delete");
        await super.delete(id);
      }
    }
    class OrderedCache extends FakeTodoCategoryCache {
      override async invalidate(userId: UserId): Promise<void> {
        events.push("cache");
        await super.invalidate(userId);
      }
    }
    const mutationLock = new OrderedMutationLock();
    const categories = [1, 2].map((id) =>
      createTodoCategoryFixture({ id, name: `카테고리 ${id}`, sortOrder: id - 1 }),
    );
    const { useCase } = setUp({
      repository: (stores) => new OrderedRepository(categories, stores),
      cache: new OrderedCache(),
      mutationLock,
      unitOfWork: new OrderedUnitOfWork(),
    });

    // When
    await useCase.execute({ userId: USER_ID, categoryId: 1 });

    // Then
    expect(mutationLock.acquiredKeys).toEqual([
      [`mutation:v1:todo-category:${USER_ID}`, `mutation:v1:todo-sort-order:${USER_ID}`],
    ]);
    expect(events).toEqual([
      "uow:start",
      "lock",
      "category-read",
      "count",
      "todo-count",
      "active-series",
      "delete",
      "uow:resolved",
      "cache",
    ]);
  });
});
