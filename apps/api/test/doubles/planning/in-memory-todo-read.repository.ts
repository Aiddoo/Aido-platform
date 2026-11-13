import type { Todo as TodoResponse } from "@aido/api";

import type { TodoCategoryId } from "#api/modules/planning/categories/domain/todo-category-id.vo";
import { TodoId } from "#api/modules/planning/shared/domain/todo-id.vo";
import type { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import type {
  FindFriendTodosParams,
  FindTodosParams,
} from "#api/modules/planning/todos/application/ports/todo-read.repository.port";
import {
  TodoReadRepositoryPort,
  type TodaySummaryTodoRow,
} from "#api/modules/planning/todos/application/ports/todo-read.repository.port";
import type {
  FriendTodoReadModel,
  TodoReadModel,
} from "#api/modules/planning/todos/application/read-models/todo.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { copyTodoRecord } from "#test/doubles/planning/in-memory-todo.repository";
import {
  createTodoReadModelFromRecord,
  type PlanningTodoRecord,
} from "#test/fixtures/todo-response.fixture";

export class InMemoryTodoReadRepository extends TodoReadRepositoryPort {
  queryResults: TodoReadModel[] = [];
  dayStats = { total: 0, completed: 0 };
  topTodos: TodaySummaryTodoRow[] = [];
  readonly records: Map<number, PlanningTodoRecord>;
  readonly categories: Map<number, TodoResponse["category"]>;
  readonly seriesStore: Map<string, TodoSeries>;

  constructor(
    records: Map<number, PlanningTodoRecord>,
    categories: Map<number, TodoResponse["category"]>,
    seriesStore: Map<string, TodoSeries> = new Map(),
  ) {
    super();
    this.records = records;
    this.categories = categories;
    this.seriesStore = seriesStore;
  }
  async findByIdAndUserId(id: TodoId, userId: UserId): Promise<TodoReadModel | null> {
    const saved = this.records.get(id.value);
    if (saved === undefined || saved.userId !== userId.value) {
      return null;
    }
    const record = copyTodoRecord(saved);
    record.items.sort((left, right) => left.sortOrder - right.sortOrder);
    record.category = this.categories.get(record.categoryId) ?? null;
    return createTodoReadModelFromRecord(record);
  }
  async findOwnerId(id: TodoId): Promise<string | null> {
    return this.records.get(id.value)?.userId ?? null;
  }
  async findManyBySeriesId(userId: UserId, seriesId: TodoSeriesId): Promise<TodoReadModel[]> {
    const records = [...this.records.values()]
      .filter((record) => record.userId === userId.value && record.seriesId === seriesId.value)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const responses: TodoReadModel[] = [];
    for (const record of records) {
      const response = await this.findByIdAndUserId(TodoId.reconstitute(record.id), userId);
      if (response !== null) {
        responses.push(response);
      }
    }
    return responses;
  }
  async findManyByUserId(_params: FindTodosParams): Promise<TodoReadModel[]> {
    return structuredClone(this.queryResults);
  }
  async findPublicTodosByUserId(_params: FindFriendTodosParams): Promise<FriendTodoReadModel[]> {
    return structuredClone(this.queryResults);
  }
  async countCategoryUsage(userId: UserId, categoryId: TodoCategoryId): Promise<number> {
    const activeSeries = [...this.seriesStore.values()].filter(
      (series) =>
        series.userId.equals(userId) && series.categoryId === categoryId.value && series.isActive,
    ).length;
    return (
      activeSeries +
      [...this.records.values()].filter(
        (record) =>
          record.userId === userId.value &&
          record.categoryId === categoryId.value &&
          !record.completed &&
          record.seriesId === null,
      ).length
    );
  }
  async countCompletedByUser(userId: UserId): Promise<number> {
    return [...this.records.values()].filter(
      (record) => record.userId === userId.value && record.completed,
    ).length;
  }
  async existsByUserId(userId: UserId): Promise<boolean> {
    return [...this.records.values()].some((record) => record.userId === userId.value);
  }
  async existsCompletedByUserId(userId: UserId): Promise<boolean> {
    return [...this.records.values()].some(
      (record) => record.userId === userId.value && record.completed,
    );
  }
  async getTodayTodoStats(
    _userId: UserId,
    _today: Temporal.PlainDate,
  ): Promise<{ total: number; completed: number }> {
    return { ...this.dayStats };
  }
  async findTodayTopTodos(
    _userId: UserId,
    _today: Temporal.PlainDate,
    _limit: number,
  ): Promise<TodaySummaryTodoRow[]> {
    return structuredClone(this.topTodos);
  }
}
