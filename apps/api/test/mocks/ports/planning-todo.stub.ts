import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type {
  FindFriendTodosParams,
  FindTodosParams,
} from "#api/modules/planning/application/models/todos/todo.types";
import type { TodoCachePort } from "#api/modules/planning/application/ports/todos/todo-cache.port";
import type {
  TodoReadRepositoryPort,
  TodaySummaryTodoRow,
} from "#api/modules/planning/application/ports/todos/todo-read.repository.port";
import type {
  TodoRepositoryPort,
  TodoUpdatePatch,
} from "#api/modules/planning/application/ports/todos/todo.repository.port";
import {
  Todo,
  type TodoCreationPlan,
  type TodoVisibility,
} from "#api/modules/planning/domain/aggregates/todos/todo.aggregate";
import { TodoItem } from "#api/modules/planning/domain/entities/todos/todo-item.entity";
import { TodoId } from "#api/modules/planning/domain/value-objects/todos/todo-id.vo";
import {
  TodoSchedule,
  type TodoScheduleProps,
} from "#api/modules/planning/domain/value-objects/todos/todo-schedule.vo";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type {
  DomainEventPublisherPort,
  MutationLockPort,
} from "#api/shared/application/ports/index";
import type { DomainEvent } from "#api/shared/domain/aggregate-root";
import { ApplicationException } from "#api/shared/domain/index";
import { TodoBuilder } from "#test/builders/index";
import {
  createTodoResponseFixture,
  type PlanningTodoRecord,
} from "#test/fixtures/todo-response.fixture";

export class StubPlanningTodoRepository implements TodoRepositoryPort {
  constructor(readonly records: Map<number, PlanningTodoRecord>) {}

  async findByIdAndUserId(id: number, userId: string): Promise<Todo | null> {
    const saved = this.records.get(id);
    if (saved === undefined || saved.userId !== userId) return null;
    const record = structuredClone(saved);
    return Todo.reconstitute({
      id: TodoId.create(record.id),
      userId: record.userId,
      title: record.title,
      categoryId: record.categoryId,
      sortOrder: record.sortOrder,
      completed: record.completed,
      completedAt: record.completedAt,
      schedule: TodoSchedule.reconstitute(record),
      visibility: record.visibility,
      recurrenceGroupId: record.recurrenceGroupId,
      items: record.items.map((item) => TodoItem.reconstitute(item)),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async create(data: TodoCreationPlan): Promise<Todo> {
    const id = Math.max(0, ...this.records.keys()) + 1;
    const record = {
      ...TodoBuilder.create(data.userId).withId(id).build(),
      ...structuredClone(data),
      endDate: data.endDate === undefined ? null : structuredClone(data.endDate),
      scheduledTime: data.scheduledTime === undefined ? null : structuredClone(data.scheduledTime),
    };
    this.records.set(id, record);
    const todo = await this.findByIdAndUserId(id, data.userId);
    if (todo === null) throw new Error("Created Todo fixture is missing");
    return todo;
  }

  async createMany(
    plans: TodoCreationPlan[],
    recurrenceGroupId: string,
    inlineItems?: readonly { title: string }[],
  ): Promise<Todo[]> {
    const created: Todo[] = [];
    for (const plan of plans) {
      const todo = await this.create(plan);
      this.#record(todo.getId().getValue()).recurrenceGroupId = recurrenceGroupId;
      if (inlineItems !== undefined)
        await this.createInlineItems(todo.getId().getValue(), [...inlineItems]);
      created.push(todo);
    }
    return created;
  }

  async createInlineItems(todoId: number, items: { title: string }[]): Promise<void> {
    for (const [sortOrder, item] of items.entries())
      await this.createItem(todoId, { ...item, sortOrder });
  }
  async updateCompletion(id: number, completed: boolean, completedAt: Date | null): Promise<void> {
    Object.assign(this.#record(id), { completed, completedAt: structuredClone(completedAt) });
  }
  async updateDetails(id: number, patch: TodoUpdatePatch): Promise<void> {
    Object.assign(
      this.#record(id),
      structuredClone(
        Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
      ),
    );
  }
  async updateTitle(id: number, title: string): Promise<void> {
    this.#record(id).title = title;
  }
  async updateVisibility(id: number, visibility: TodoVisibility): Promise<void> {
    this.#record(id).visibility = visibility;
  }
  async updateSchedule(id: number, schedule: TodoScheduleProps): Promise<void> {
    Object.assign(this.#record(id), structuredClone(schedule));
  }
  async updateCategory(id: number, categoryId: number): Promise<void> {
    this.#record(id).categoryId = categoryId;
  }
  async delete(id: number): Promise<void> {
    this.records.delete(id);
  }
  async updateSortOrder(id: number, sortOrder: number): Promise<void> {
    this.#record(id).sortOrder = sortOrder;
  }
  async shiftSortOrders(
    userId: string,
    from: number,
    to: number | null,
    delta: number,
  ): Promise<void> {
    for (const record of this.records.values())
      if (
        record.userId === userId &&
        record.sortOrder >= from &&
        (to === null || record.sortOrder <= to)
      )
        record.sortOrder += delta;
  }
  async countActiveByCategory(userId: string, categoryId: number): Promise<number> {
    return [...this.records.values()].filter(
      (record) => record.userId === userId && record.categoryId === categoryId && !record.completed,
    ).length;
  }
  async getMaxSortOrder(userId: string): Promise<number> {
    return Math.max(
      -1,
      ...[...this.records.values()]
        .filter((record) => record.userId === userId)
        .map((record) => record.sortOrder),
    );
  }
  async createItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void> {
    const id =
      Math.max(
        0,
        ...[...this.records.values()].flatMap((record) => record.items.map((item) => item.id)),
      ) + 1;
    this.#record(todoId).items.push({
      id,
      ...data,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  async updateItem(itemId: number, data: { title?: string; completed?: boolean }): Promise<void> {
    const item = [...this.records.values()]
      .flatMap((record) => record.items)
      .find((entry) => entry.id === itemId);
    if (item === undefined) throw new Error("Todo item fixture is missing");
    Object.assign(
      item,
      Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
    );
  }
  async deleteItem(itemId: number): Promise<void> {
    for (const record of this.records.values())
      record.items = record.items.filter((item) => item.id !== itemId);
  }
  async reorderItems(itemIds: number[]): Promise<void> {
    for (const [sortOrder, id] of itemIds.entries()) {
      const item = [...this.records.values()]
        .flatMap((record) => record.items)
        .find((entry) => entry.id === id);
      if (item !== undefined) item.sortOrder = sortOrder;
    }
    for (const record of this.records.values())
      record.items.sort((left, right) => left.sortOrder - right.sortOrder);
  }
  #record(id: number): PlanningTodoRecord {
    const record = this.records.get(id);
    if (record === undefined) throw new Error("Todo fixture is missing");
    return record;
  }
}

export class StubPlanningTodoReadRepository implements TodoReadRepositoryPort {
  queryResults: TodoResponse[] = [];
  dayStats = { total: 0, completed: 0 };
  topTodos: TodaySummaryTodoRow[] = [];
  constructor(
    readonly records: Map<number, PlanningTodoRecord>,
    readonly categories: Map<number, TodoResponse["category"]>,
  ) {}
  async findByIdAndUserId(id: number, userId: string): Promise<TodoResponse | null> {
    const saved = this.records.get(id);
    if (saved === undefined || saved.userId !== userId) return null;
    const record = structuredClone(saved);
    record.items.sort((left, right) => left.sortOrder - right.sortOrder);
    record.category = this.categories.get(record.categoryId) ?? null;
    return createTodoResponseFixture(record);
  }
  async findOwnerId(id: number): Promise<string | null> {
    return this.records.get(id)?.userId ?? null;
  }
  async findManyByRecurrenceGroupId(
    userId: string,
    recurrenceGroupId: string,
  ): Promise<TodoResponse[]> {
    const records = [...this.records.values()]
      .filter(
        (record) => record.userId === userId && record.recurrenceGroupId === recurrenceGroupId,
      )
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const responses: TodoResponse[] = [];
    for (const record of records) {
      const response = await this.findByIdAndUserId(record.id, userId);
      if (response !== null) responses.push(response);
    }
    return responses;
  }
  async findManyByUserId(_params: FindTodosParams): Promise<TodoResponse[]> {
    return structuredClone(this.queryResults);
  }
  async findPublicTodosByUserId(_params: FindFriendTodosParams): Promise<TodoResponse[]> {
    return structuredClone(this.queryResults);
  }
  async countActiveByCategory(userId: string, categoryId: number): Promise<number> {
    return [...this.records.values()].filter(
      (record) => record.userId === userId && record.categoryId === categoryId && !record.completed,
    ).length;
  }
  async countCompletedByUser(userId: string): Promise<number> {
    return [...this.records.values()].filter(
      (record) => record.userId === userId && record.completed,
    ).length;
  }
  async getTodayTodoStats(
    _userId: string,
    _today: Date,
  ): Promise<{ total: number; completed: number }> {
    return { ...this.dayStats };
  }
  async findTodayTopTodos(
    _userId: string,
    _today: Date,
    _limit: number,
  ): Promise<TodaySummaryTodoRow[]> {
    return structuredClone(this.topTodos);
  }
}

export class StubPlanningTodoCache implements TodoCachePort {
  readonly categoryUsers = new Set<string>();
  readonly pages = new Map<string, CursorPaginatedResponse<TodoResponse, number>>();
  readonly generations = new Map<string, number>();
  async invalidateTodoCategories(userId: string): Promise<void> {
    this.categoryUsers.delete(userId);
  }
  async readFriendTodosFirstPage(userId: string, start: string, end: string, size: number) {
    const page = this.pages.get(this.#key(userId, start, end, size));
    return {
      generation: String(this.generations.get(userId) ?? 0),
      page: page === undefined ? undefined : structuredClone(page),
    };
  }
  async storeFriendTodosFirstPageIfCurrent(
    userId: string,
    start: string,
    end: string,
    size: number,
    generation: string,
    page: CursorPaginatedResponse<TodoResponse, number>,
  ): Promise<void> {
    if (generation === String(this.generations.get(userId) ?? 0))
      this.pages.set(this.#key(userId, start, end, size), structuredClone(page));
  }
  async invalidateFriendTodos(userId: string): Promise<void> {
    this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1);
    for (const key of this.pages.keys()) if (key.startsWith(`${userId}:`)) this.pages.delete(key);
  }
  #key(userId: string, start: string, end: string, size: number): string {
    return `${userId}:${start}:${end}:${size}`;
  }
}

export class StubPlanningEventPublisher implements DomainEventPublisherPort {
  readonly events: DomainEvent[] = [];
  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    this.events.push(...events);
  }
}

export class StubPlanningMutationLock implements MutationLockPort {
  readonly acquired: string[][] = [];
  async acquire(keys: readonly string[]): Promise<void> {
    this.acquired.push([...keys]);
  }
}

export function createCategoryOwnershipStub(
  categories: Map<number, TodoResponse["category"]>,
  owners: Map<number, string>,
) {
  return {
    async validateOwnership(categoryId: number, userId: string): Promise<void> {
      if (!categories.has(categoryId) || owners.get(categoryId) !== userId)
        throw new ApplicationException(ErrorCode.TODO_CATEGORY_0851, { categoryId });
    },
  };
}
