import { TODO_SORT_ORDER_GAP } from "#api/modules/planning/shared/domain/todo-sort-order.domain-service";
import type { TodoCategoryId } from "#api/modules/planning/todo-categories/domain/todo-category-id.vo";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import {
  type RebaseCandidate,
  type RebaseCandidateQuery,
  type RebasedInstant,
  TodoRepositoryPort,
  type TodoSortEdge,
  type TodoSortNeighborQuery,
} from "#api/modules/planning/todos/application/ports/todo.repository.port";
import { TodoId } from "#api/modules/planning/todos/domain/todo-id.vo";
import { TodoItemId } from "#api/modules/planning/todos/domain/todo-item-id.vo";
import { Todo } from "#api/modules/planning/todos/domain/todo.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  type PlanningTodoRecord,
  createPlanningTodoRecordFixture,
} from "#test/fixtures/planning/todo-response.fixture";

// Temporal 값은 바뀌지 않아 structuredClone 대신 행과 하위 항목만 복사한다
export function copyTodoRecord(record: PlanningTodoRecord): PlanningTodoRecord {
  return {
    ...record,
    items: record.items.map((item) => ({ ...item })),
    category: record.category == null ? null : { ...record.category },
  };
}

// 할 일 id·하위 항목 id를 InMemory 저장소와 회차 쓰기가 함께 쓴다
export class InMemoryTodoSequence {
  #todo = 0;
  #item = 0;

  nextTodoId(records: Map<number, PlanningTodoRecord>): number {
    this.#todo = Math.max(this.#todo, ...records.keys()) + 1;
    return this.#todo;
  }

  nextItemId(records: Map<number, PlanningTodoRecord>): number {
    this.#item =
      Math.max(
        this.#item,
        ...[...records.values()].flatMap((record) => record.items.map((item) => item.id)),
      ) + 1;
    return this.#item;
  }
}

export class InMemoryTodoRepository extends TodoRepositoryPort {
  readonly records: Map<number, PlanningTodoRecord>;
  readonly seriesStore: Map<string, TodoSeries>;
  readonly sequence: InMemoryTodoSequence;

  constructor(
    records: Map<number, PlanningTodoRecord>,
    seriesStore: Map<string, TodoSeries> = new Map(),
    sequence: InMemoryTodoSequence = new InMemoryTodoSequence(),
  ) {
    super();
    this.records = records;
    this.seriesStore = seriesStore;
    this.sequence = sequence;
  }

  async findByIdAndUserId(id: TodoId, userId: UserId): Promise<Todo | null> {
    const saved = this.records.get(id.value);
    if (saved === undefined || saved.userId !== userId.value) {
      return null;
    }
    return Todo.reconstitute(copyTodoRecord(saved));
  }

  async lockByIdAndUserId(id: TodoId, userId: UserId): Promise<Todo | null> {
    return this.findByIdAndUserId(id, userId);
  }

  async nextId(): Promise<TodoId> {
    return TodoId.reconstitute(this.sequence.nextTodoId(this.records));
  }

  async nextItemId(): Promise<TodoItemId> {
    return TodoItemId.reconstitute(this.sequence.nextItemId(this.records));
  }

  async insert(todo: Todo): Promise<void> {
    const primitives = todo.toPrimitives();
    this.records.set(primitives.id, {
      ...createPlanningTodoRecordFixture({ userId: primitives.userId, id: primitives.id }),
      ...primitives,
      items: [],
    });
  }

  async createInlineItems(todoId: TodoId, items: readonly { title: string }[]): Promise<void> {
    for (const [sortOrder, item] of items.entries()) {
      this.#record(todoId.value).items.push({
        id: (await this.nextItemId()).value,
        ...item,
        sortOrder,
        completed: false,
        createdAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      });
    }
  }

  // 댓글·조회 수와 카테고리 표시 값은 저장한 행의 것을 그대로 둔다
  async save(todo: Todo): Promise<void> {
    const { userId: _userId, createdAt: _createdAt, ...primitives } = todo.toPrimitives();
    const record = this.#record(primitives.id);
    Object.assign(record, primitives, { items: primitives.items.map((item) => ({ ...item })) });
  }

  async delete(todo: Todo): Promise<void> {
    this.#record(todo.id.value);
    this.records.delete(todo.id.value);
  }

  async findAdjacentSortOrder(
    userId: UserId,
    neighbor: TodoSortNeighborQuery,
  ): Promise<number | null> {
    const { from, direction, excludeId } = neighbor;
    const isAfter = (record: { id: number; sortOrder: number }) =>
      record.sortOrder > from.sortOrder ||
      (record.sortOrder === from.sortOrder && record.id > from.id.value);
    const isBefore = (record: { id: number; sortOrder: number }) =>
      record.sortOrder < from.sortOrder ||
      (record.sortOrder === from.sortOrder && record.id < from.id.value);
    const candidates = this.#ordered(userId).filter(
      (record) =>
        record.id !== excludeId.value &&
        (direction === "next" ? isAfter(record) : isBefore(record)),
    );
    const found = direction === "next" ? candidates.at(0) : candidates.at(-1);
    return found?.sortOrder ?? null;
  }

  async findEdgeSortOrder(
    userId: UserId,
    edge: TodoSortEdge,
    excludeId: TodoId,
  ): Promise<number | null> {
    const ordered = this.#ordered(userId).filter((record) => record.id !== excludeId.value);
    const found = edge === "first" ? ordered.at(0) : ordered.at(-1);
    return found?.sortOrder ?? null;
  }

  async renumberSortOrders(userId: UserId): Promise<void> {
    for (const [index, { id }] of this.#ordered(userId).entries()) {
      this.#record(id).sortOrder = (index + 1) * TODO_SORT_ORDER_GAP;
    }
  }

  async getMaxSortOrder(userId: UserId): Promise<number> {
    return Math.max(
      -1,
      ...[...this.records.values()]
        .filter((record) => record.userId === userId.value)
        .map((record) => record.sortOrder),
    );
  }

  async countCategoryUsage(userId: UserId, categoryId: TodoCategoryId): Promise<number> {
    const activeSeries = [...this.seriesStore.values()].filter(
      (series) =>
        series.userId.equals(userId) && series.categoryId === categoryId.value && series.isActive(),
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

  async lockRebaseCandidates(query: RebaseCandidateQuery): Promise<readonly RebaseCandidate[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.userId === query.userId.value &&
          record.scheduledTime != null &&
          record.scheduledLocalTime != null &&
          (query.afterId == null || record.id > query.afterId.value),
      )
      .sort((left, right) => left.id - right.id)
      .slice(0, query.limit)
      .flatMap((record) =>
        record.scheduledTime == null || record.scheduledLocalTime == null
          ? []
          : [
              {
                todoId: TodoId.reconstitute(record.id),
                startDate: record.startDate,
                scheduledLocalTime: record.scheduledLocalTime,
                scheduledTime: record.scheduledTime,
                completed: record.completed,
              },
            ],
      );
  }

  async updateRebasedInstants(instants: readonly RebasedInstant[]): Promise<void> {
    for (const { todoId, scheduledTime } of instants) {
      this.#record(todoId.value).scheduledTime = scheduledTime;
    }
  }

  async seedItem(todoId: number, data: { title: string; sortOrder: number }): Promise<void> {
    this.#record(todoId).items.push({
      id: (await this.nextItemId()).value,
      ...data,
      completed: false,
      createdAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
    });
  }

  // (sortOrder, id) 순서로 줄 세운 그 사용자 할 일
  #ordered(userId: UserId): { id: number; sortOrder: number }[] {
    return [...this.records.values()]
      .filter((record) => record.userId === userId.value)
      .map(({ id, sortOrder }) => ({ id, sortOrder }))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
  }

  #record(id: number): PlanningTodoRecord {
    const record = this.records.get(id);
    if (record === undefined) {
      throw new Error("Todo fixture is missing");
    }
    return record;
  }
}
