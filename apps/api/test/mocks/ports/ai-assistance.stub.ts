import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import type {
  AiReportRepositoryPort,
  CreateAiReportInput,
  FindReportsParams,
} from "#api/modules/ai-assistance/application/ports/reports/ai-report.repository.port";
import type { TodoStatsReaderPort } from "#api/modules/ai-assistance/application/ports/reports/todo-stats.reader.port";
import type {
  AiSuggestionRepositoryPort,
  CreateSuggestionInput,
} from "#api/modules/ai-assistance/application/ports/suggestions/ai-suggestion.repository.port";
import type { WeeklyReportReaderPort } from "#api/modules/ai-assistance/application/ports/suggestions/weekly-report-reader.port";
import {
  Suggestion,
  type SuggestionProps,
  type SuggestionStatus,
} from "#api/modules/ai-assistance/domain/aggregates/suggestions/suggestion.aggregate";
import { AiReport } from "#api/modules/ai-assistance/domain/entities/reports/ai-report.entity";
import type {
  AggregateParams,
  AggregationInputs,
} from "#api/modules/ai-assistance/domain/types/reports/ai-report.types";
import type {
  TodoSummaryForAnalysis,
  SuggestionHistoryItem,
} from "#api/modules/ai-assistance/domain/types/suggestions/ai-suggestion.types";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type {
  WeatherForecastReaderPort,
  GridInput,
  WeatherForecast,
} from "#api/modules/weather/weather-forecast.public";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

/** 콜백 조립 Stub. 실제 PostgreSQL rollback/lock 보장은 Integration에서 검증한다. */
export class StubAiGenerationUnitOfWork implements UnitOfWorkPort {
  depth = 0;
  runs = 0;
  async run<T>(work: () => Promise<T>): Promise<T> {
    this.runs += 1;
    this.depth += 1;
    try {
      return await work();
    } finally {
      this.depth -= 1;
    }
  }
}

export class StubAiGenerationAccess
  implements Pick<EntitlementReaderPort, "hasPremiumAccessInTx">, UserMutationLockPort
{
  role = "USER";
  subscriptionStatus = "ACTIVE";
  status = "ACTIVE";
  deletedAt: Date | null = null;
  exists = true;
  readonly reads: Array<{ inUnitOfWork: boolean; eligible: boolean }> = [];
  readonly locks: boolean[] = [];
  constructor(readonly unitOfWork: StubAiGenerationUnitOfWork) {}
  async hasPremiumAccessInTx(_userId: string): Promise<boolean> {
    const eligible =
      this.exists &&
      this.status === "ACTIVE" &&
      this.deletedAt === null &&
      (this.role === "ADMIN" || this.subscriptionStatus === "ACTIVE");
    this.reads.push({ inUnitOfWork: this.unitOfWork.depth > 0, eligible });
    return eligible;
  }
  async lockById(_userId: string): Promise<boolean> {
    this.locks.push(this.unitOfWork.depth > 0);
    return this.exists;
  }
}

export class StubAiSuggestionRepository implements AiSuggestionRepositoryPort {
  readonly rows = new Map<number, SuggestionProps>();
  todos: TodoSummaryForAnalysis[] = [];
  streak: { currentStreak: number; longestStreak: number } | null = {
    currentStreak: 3,
    longestStreak: 5,
  };
  history: SuggestionHistoryItem[] = [];
  readonly writes: string[] = [];
  readonly saved: CreateSuggestionInput[] = [];
  private nextId = 100;
  async findPendingByUserId(userId: string) {
    return [...this.rows.values()]
      .filter(
        (row) => row.userId === userId && row.status === "PENDING" && row.expiresAt >= new Date(),
      )
      .map((row) => Suggestion.reconstitute(row));
  }
  async findByIdAndUserId(id: number, userId: string) {
    const row = this.rows.get(id);
    return row?.userId === userId ? Suggestion.reconstitute(row) : null;
  }
  async updateStatus(id: number, status: SuggestionStatus) {
    const row = this.rows.get(id);
    if (!row) throw new Error("존재하지 않는 제안");
    const updated = { ...row, status };
    this.rows.set(id, updated);
    this.writes.push("updateStatus");
    return Suggestion.reconstitute(updated);
  }
  async createMany(data: CreateSuggestionInput[]) {
    this.writes.push("createMany");
    this.saved.push(...structuredClone(data));
    for (const input of data) {
      const id = this.nextId++;
      this.rows.set(id, {
        ...structuredClone(input),
        id,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return { count: data.length };
  }
  async deletePending(userId: string) {
    this.writes.push("deletePending");
    return this.remove((row) => row.userId === userId && row.status === "PENDING");
  }
  async deleteExpired(userId: string) {
    this.writes.push("deleteExpired");
    return this.remove((row) => row.userId === userId && row.expiresAt < new Date());
  }
  private remove(predicate: (row: SuggestionProps) => boolean) {
    let count = 0;
    for (const [id, row] of this.rows)
      if (predicate(row)) {
        this.rows.delete(id);
        count += 1;
      }
    return { count };
  }
  async findRecentTodos() {
    return structuredClone(this.todos);
  }
  async findDayCompletionRates() {
    return [{ day: "MON" as const, total: 5, completed: 4 }];
  }
  async findTimeCompletionRates() {
    return { morning: { count: 5, rate: 80 }, afternoon: { count: 0, rate: 0 } };
  }
  async findCategoryCompletionRates() {
    return [{ name: "독서", total: 5, completed: 4, rate: 80 }];
  }
  async findUserStreakInfo() {
    return this.streak;
  }
  async findRecentResponded() {
    return structuredClone(this.history);
  }
}

export class StubAiReportRepository implements AiReportRepositoryPort {
  readonly saved: CreateAiReportInput[] = [];
  readonly rows = new Map<number, AiReport>();
  duplicate = false;
  async create(input: CreateAiReportInput) {
    this.saved.push(structuredClone(input));
    const id = this.rows.size + 1;
    const report = AiReport.reconstitute({ id, ...structuredClone(input) });
    this.rows.set(id, report);
    return report;
  }
  async findByIdAndUserId(id: number, userId: string) {
    const row = this.rows.get(id);
    return row?.snapshot.userId === userId ? row : null;
  }
  async findLatest(userId: string, type: "WEEKLY" | "MONTHLY") {
    return (
      [...this.rows.values()].find((row) => row.snapshot.userId === userId && row.type === type) ??
      null
    );
  }
  async findMany(params: FindReportsParams) {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.snapshot.userId === params.userId && (!params.type || row.type === params.type),
      )
      .slice(0, params.limit);
  }
  async exists(userId: string, type: "WEEKLY" | "MONTHLY", year: number, period: number) {
    return (
      this.duplicate ||
      this.saved.some(
        (row) =>
          row.userId === userId && row.type === type && row.year === year && row.period === period,
      )
    );
  }
}

export class StubAiTodoStatsReader implements TodoStatsReaderPort {
  readonly calls: AggregateParams[] = [];
  inputs: AggregationInputs = {
    dailyTotalGroups: [],
    dailyCompletedGroups: [],
    prevTotalCount: 0,
    prevCompletedCount: 0,
    catTotalGroups: [],
    catCompletedGroups: [],
    categories: [],
    completedTodos: [],
  };
  async fetchAggregationInputs(params: AggregateParams) {
    this.calls.push(structuredClone(params));
    return structuredClone(this.inputs);
  }
}

export class StubAiWeeklyReportReader implements WeeklyReportReaderPort {
  report: Awaited<ReturnType<WeeklyReportReaderPort["findLatestWeekly"]>> = null;
  async findLatestWeekly() {
    return this.report;
  }
}

export class StubAiWeatherForecastReader implements WeatherForecastReaderPort {
  forecasts = new Map<string, WeatherForecast>();
  failure: Error | null = null;
  calls = 0;
  async getForecastsByGridBatch(_grids: GridInput[], _date: Date) {
    this.calls += 1;
    if (this.failure) throw this.failure;
    return this.forecasts;
  }
}
