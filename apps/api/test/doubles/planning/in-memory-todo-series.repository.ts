import {
  type TodoSeriesRef,
  type DueTodoSeriesQuery,
  TodoSeriesRepositoryPort,
} from "#api/modules/planning/todo-series/application/ports/todo-series.repository.port";
import { TodoSeriesId } from "#api/modules/planning/todo-series/domain/todo-series-id.vo";
import { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export class InMemoryTodoSeriesRepository extends TodoSeriesRepositoryPort {
  readonly store: Map<string, TodoSeries>;

  constructor(store: Map<string, TodoSeries> = new Map()) {
    super();
    this.store = store;
  }

  async updateTimezoneByUserId(userId: UserId, timezone: string): Promise<number> {
    const owned = [...this.store.values()].filter(
      (series) => series.userId.equals(userId) && series.timezone !== timezone,
    );
    for (const series of owned) {
      series.applyDetails({ timezone });
    }
    return owned.length;
  }
  async findByIdAndUserId(id: TodoSeriesId, userId: UserId): Promise<TodoSeries | null> {
    const series = this.store.get(id.value);
    return series === undefined || !series.userId.equals(userId) ? null : this.#copy(series);
  }
  async lockForUpdate(id: TodoSeriesId): Promise<TodoSeries | null> {
    const series = this.store.get(id.value);
    return series === undefined ? null : this.#copy(series);
  }
  async insert(series: TodoSeries): Promise<void> {
    this.store.set(series.id.value, this.#copy(series));
  }
  async update(series: TodoSeries): Promise<void> {
    this.store.set(series.id.value, this.#copy(series));
  }
  async lockFamilyIds(
    userId: UserId,
    originSeriesId: TodoSeriesId,
  ): Promise<readonly TodoSeriesId[]> {
    return [...this.store.values()]
      .filter(
        (series) => series.userId.equals(userId) && series.originSeriesId.equals(originSeriesId),
      )
      .map((series) => TodoSeriesId.reconstitute(series.id.value));
  }
  async lockFollowingSegments(series: TodoSeries): Promise<readonly TodoSeries[]> {
    return [...this.store.values()]
      .filter(
        (segment) =>
          segment.userId.value === series.userId.value &&
          segment.originSeriesId.value === series.originSeriesId.value &&
          segment.startDate >= series.startDate &&
          segment.id.value !== series.id.value,
      )
      .map((segment) => this.#copy(segment));
  }
  async deleteMany(ids: readonly TodoSeriesId[]): Promise<void> {
    for (const id of ids) {
      this.store.delete(id.value);
    }
  }
  async countActiveByUserId(userId: UserId): Promise<number> {
    return [...this.store.values()].filter(
      (series) => series.userId.equals(userId) && series.isActive,
    ).length;
  }
  async existsActiveByUserId(userId: UserId): Promise<boolean> {
    return [...this.store.values()].some(
      (series) => series.userId.equals(userId) && series.isActive,
    );
  }
  async findDueBatch(query: DueTodoSeriesQuery): Promise<readonly TodoSeriesRef[]> {
    return [...this.store.values()]
      .filter((series) => {
        const next = series.nextOccurrenceDate;
        return (
          next !== null &&
          next <= query.through &&
          (query.afterId === null || series.id.value > query.afterId.value)
        );
      })
      .map((series) => ({
        id: series.id.value,
        userId: series.userId.value,
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, query.limit);
  }
  async findIdsBehind(userId: UserId, through: string): Promise<readonly string[]> {
    return [...this.store.values()]
      .filter((series) => {
        const next = series.nextOccurrenceDate;
        return series.userId.equals(userId) && next !== null && next <= through;
      })
      .map((series) => series.id.value);
  }
  #copy(series: TodoSeries): TodoSeries {
    return TodoSeries.reconstitute(series.toPrimitives());
  }
}
