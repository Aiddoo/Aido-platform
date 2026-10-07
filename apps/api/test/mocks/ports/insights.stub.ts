import type { DailyCompletionCachePort } from "#api/modules/insights/application/ports/daily-completions/daily-completion-cache.port";
import type { DailyCompletionFollowReaderPort } from "#api/modules/insights/application/ports/daily-completions/daily-completion-follow-reader.port";
import type {
  AggregateByDateRangeParams,
  TodoCompletionRepositoryPort,
} from "#api/modules/insights/application/ports/daily-completions/todo-completion.repository.port";
import type { WeeklyAchievementRepositoryPort } from "#api/modules/insights/application/ports/weekly-achievements/weekly-achievement.repository.port";
import type {
  DailyCompletionsRange,
  TodoAggregateByDate,
} from "#api/modules/insights/domain/records/daily-completions/daily-completion.record";
import type {
  WeeklyAchievementRow,
  WeeklyAchievementUpsert,
} from "#api/modules/insights/domain/records/weekly-achievements/weekly-achievement.record";

export class StubTodoCompletionRepository implements TodoCompletionRepositoryPort {
  readonly ownAggregates = new Map<string, readonly TodoAggregateByDate[]>();
  readonly publicAggregates = new Map<string, readonly TodoAggregateByDate[]>();

  async aggregateByDateRange(input: AggregateByDateRangeParams): Promise<TodoAggregateByDate[]> {
    return structuredClone([...(this.ownAggregates.get(input.userId) ?? [])]);
  }
  async aggregatePublicByDateRange(
    input: AggregateByDateRangeParams,
  ): Promise<TodoAggregateByDate[]> {
    return structuredClone([...(this.publicAggregates.get(input.userId) ?? [])]);
  }
}

interface CachedRange {
  readonly ownerId: string;
  readonly value: DailyCompletionsRange;
}

export class StubDailyCompletionCache implements DailyCompletionCachePort {
  readonly #generations = new Map<string, number>();
  readonly #ranges = new Map<string, CachedRange>();

  async readRange(userId: string, start: string, end: string) {
    return this.#read("own", userId, start, end);
  }
  async readPublicRange(ownerId: string, start: string, end: string) {
    return this.#read("public", ownerId, start, end);
  }
  async storeRangeIfCurrent(
    userId: string,
    start: string,
    end: string,
    generation: string,
    value: DailyCompletionsRange,
  ): Promise<void> {
    this.#store("own", userId, start, end, generation, value);
  }
  async storePublicRangeIfCurrent(
    ownerId: string,
    start: string,
    end: string,
    generation: string,
    value: DailyCompletionsRange,
  ): Promise<void> {
    this.#store("public", ownerId, start, end, generation, value);
  }
  async invalidate(userId: string): Promise<void> {
    this.#generations.set(userId, (this.#generations.get(userId) ?? 0) + 1);
    for (const [key, entry] of this.#ranges) {
      if (entry.ownerId === userId) this.#ranges.delete(key);
    }
  }
  #read(scope: string, userId: string, start: string, end: string) {
    return {
      generation: String(this.#generations.get(userId) ?? 0),
      value: structuredClone(this.#ranges.get(JSON.stringify([scope, userId, start, end]))?.value),
    };
  }
  #store(
    scope: string,
    userId: string,
    start: string,
    end: string,
    generation: string,
    value: DailyCompletionsRange,
  ) {
    if (generation !== String(this.#generations.get(userId) ?? 0)) return;
    this.#ranges.set(JSON.stringify([scope, userId, start, end]), {
      ownerId: userId,
      value: structuredClone(value),
    });
  }
}

export class StubInsightsFriend implements DailyCompletionFollowReaderPort {
  readonly mutualPairs = new Set<string>();
  async isMutualFriend(userId: string, friendId: string): Promise<boolean> {
    return this.mutualPairs.has(JSON.stringify([userId, friendId]));
  }
}

export class StubWeeklyAchievementRepository implements WeeklyAchievementRepositoryPort {
  readonly pages = new Map<string, readonly WeeklyAchievementRow[]>();
  readonly years = new Map<string, readonly WeeklyAchievementRow[]>();
  readonly rows = new Map<string, WeeklyAchievementRow>();
  #nextId = 0;

  async findByYear(
    userId: string,
    year: number,
    _cursor: number | undefined,
    _take: number,
  ): Promise<WeeklyAchievementRow[]> {
    return structuredClone([...(this.pages.get(JSON.stringify([userId, year])) ?? [])]);
  }
  async findAllByYear(userId: string, year: number): Promise<WeeklyAchievementRow[]> {
    return structuredClone([...(this.years.get(JSON.stringify([userId, year])) ?? [])]);
  }
  async findByYearAndWeek(
    userId: string,
    year: number,
    week: number,
  ): Promise<WeeklyAchievementRow | null> {
    return structuredClone(this.rows.get(JSON.stringify([userId, year, week])) ?? null);
  }
  async upsertMany(records: readonly WeeklyAchievementUpsert[]): Promise<void> {
    for (const record of records) {
      const key = JSON.stringify([record.userId, record.year, record.week]);
      const id = this.rows.get(key)?.id ?? ++this.#nextId;
      this.rows.set(
        key,
        structuredClone({
          id,
          year: record.year,
          week: record.week,
          totalTodos: record.totalTodos,
          completedTodos: record.completedTodos,
          achievedAt: record.achievedAt,
        }),
      );
    }
  }
}
