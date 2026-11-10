import { ErrorCode } from "@aido/api/errors";

import {
  TodoCategoryRepositoryPort,
  type UpdateCategoryInput,
} from "#api/modules/planning/categories/application/ports/todo-category.repository.port";
import type { TodoCategoryWithCountReadModel } from "#api/modules/planning/categories/application/read-models/todo-category-with-count.read-model";
import { TodoCategoryId } from "#api/modules/planning/categories/domain/todo-category-id.vo";
import { TodoCategory } from "#api/modules/planning/categories/domain/todo-category.aggregate";
import type { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { ApplicationException } from "#api/shared/application/application.exception";
import { toIsoString } from "#api/shared/domain/time/instant";
import type { PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";

// 할 일 개수·옮기기는 같은 planning 대역(InMemoryTodoRepository)의 기록을 함께 본다
export interface InMemoryPlanningStores {
  readonly todoRecords: Map<number, PlanningTodoRecord>;
  readonly seriesStore: Map<string, TodoSeries>;
}

function copyOf(category: TodoCategory): TodoCategory {
  return TodoCategory.reconstitute(category.toPrimitives());
}

export class InMemoryTodoCategoryRepository extends TodoCategoryRepositoryPort {
  readonly #categories = new Map<number, TodoCategory>();
  readonly #stores: InMemoryPlanningStores;
  #sequence: number;

  constructor(
    categories: readonly TodoCategory[] = [],
    stores: InMemoryPlanningStores = { todoRecords: new Map(), seriesStore: new Map() },
  ) {
    super();
    for (const category of categories) {
      this.#categories.set(category.id.value, copyOf(category));
    }
    this.#stores = stores;
    this.#sequence = Math.max(0, ...this.#categories.keys());
  }

  async nextId(): Promise<TodoCategoryId> {
    this.#sequence += 1;
    return TodoCategoryId.reconstitute(this.#sequence);
  }

  async insert(category: TodoCategory): Promise<void> {
    this.#assertUniqueName(category.userId.value, category.name.value, null);
    this.#categories.set(category.id.value, copyOf(category));
  }

  async update(id: number, input: UpdateCategoryInput): Promise<TodoCategory> {
    const current = this.#require(id);
    const primitives = current.toPrimitives();
    if (input.name != null) {
      this.#assertUniqueName(primitives.userId, input.name, id);
    }
    const updated = TodoCategory.reconstitute({
      ...primitives,
      name: input.name ?? primitives.name,
      color: input.color ?? primitives.color,
      sortOrder: input.sortOrder ?? primitives.sortOrder,
    });
    this.#categories.set(id, updated);
    return copyOf(updated);
  }

  async delete(id: number): Promise<void> {
    this.#require(id);
    for (const [seriesId, series] of this.#stores.seriesStore) {
      if (series.categoryId === id && !series.isActive) {
        this.#stores.seriesStore.delete(seriesId);
      }
    }
    this.#categories.delete(id);
  }

  async findByIdAndUserId(id: number, userId: string): Promise<TodoCategory | null> {
    const category = this.#categories.get(id);
    return category != null && category.userId.value === userId ? copyOf(category) : null;
  }

  async findByIdWithCount(id: number): Promise<TodoCategoryWithCountReadModel | null> {
    const category = this.#categories.get(id);
    return category == null ? null : this.#withCount(category);
  }

  async findManyByUserId(userId: string): Promise<TodoCategoryWithCountReadModel[]> {
    return [...this.#categories.values()]
      .filter((category) => category.userId.value === userId)
      .toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.value - right.id.value)
      .map((category) => this.#withCount(category));
  }

  async countByUserId(userId: string): Promise<number> {
    return [...this.#categories.values()].filter((category) => category.userId.value === userId)
      .length;
  }

  async existsByUserIdAndName(userId: string, name: string, excludeId?: number): Promise<boolean> {
    return [...this.#categories.values()].some(
      (category) =>
        category.userId.value === userId &&
        category.name.value === name &&
        category.id.value !== excludeId,
    );
  }

  async getMaxSortOrder(userId: string): Promise<number> {
    return Math.max(
      -1,
      ...[...this.#categories.values()]
        .filter((category) => category.userId.value === userId)
        .map((category) => category.sortOrder),
    );
  }

  async shiftSortOrders(
    userId: string,
    fromSortOrder: number,
    toSortOrder: number | null,
    delta: number,
  ): Promise<number> {
    let shifted = 0;
    for (const [id, category] of this.#categories) {
      const isInRange =
        category.sortOrder >= fromSortOrder &&
        (toSortOrder == null || category.sortOrder <= toSortOrder);
      if (category.userId.value === userId && isInRange) {
        this.#categories.set(
          id,
          TodoCategory.reconstitute({
            ...category.toPrimitives(),
            sortOrder: category.sortOrder + delta,
          }),
        );
        shifted += 1;
      }
    }
    return shifted;
  }

  async getTodoCount(categoryId: number): Promise<number> {
    return [...this.#stores.todoRecords.values()].filter(
      (record) => record.categoryId === categoryId,
    ).length;
  }

  async countActiveSeries(categoryId: number): Promise<number> {
    return [...this.#stores.seriesStore.values()].filter(
      (series) => series.categoryId === categoryId && series.isActive,
    ).length;
  }

  async moveTodosToCategory(fromCategoryId: number, toCategoryId: number): Promise<void> {
    for (const record of this.#stores.todoRecords.values()) {
      if (record.categoryId === fromCategoryId) {
        record.categoryId = toCategoryId;
      }
    }
    for (const series of this.#stores.seriesStore.values()) {
      if (series.categoryId === fromCategoryId) {
        series.applyDetails({ categoryId: toCategoryId });
      }
    }
  }

  #withCount(category: TodoCategory): TodoCategoryWithCountReadModel {
    const { createdAt, updatedAt, ...primitives } = category.toPrimitives();
    return {
      ...primitives,
      createdAt: toIsoString(createdAt),
      updatedAt: toIsoString(updatedAt),
      todoCount: [...this.#stores.todoRecords.values()].filter(
        (record) => record.categoryId === category.id.value,
      ).length,
    };
  }

  #assertUniqueName(userId: string, name: string, excludeId: number | null): void {
    const duplicate = [...this.#categories.values()].some(
      (category) =>
        category.userId.value === userId &&
        category.name.value === name &&
        category.id.value !== excludeId,
    );
    if (duplicate) {
      throw new ApplicationException(ErrorCode.TODO_CATEGORY_0853, { name });
    }
  }

  #require(id: number): TodoCategory {
    const category = this.#categories.get(id);
    if (category == null) {
      throw new DatabaseRecordNotFoundError();
    }
    return category;
  }
}
