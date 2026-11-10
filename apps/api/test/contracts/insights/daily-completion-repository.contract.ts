import type { DailyCompletionRepositoryPort } from "#api/modules/insights/daily-completions/application/ports/daily-completion.repository.port";
import type { DailyCompletion } from "#api/modules/insights/daily-completions/domain/daily-completion.entity";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  calendarDate,
  createDateRangeFixture,
  createTodoSeedFixture,
  DAILY_COMPLETION_FIXTURE_FRIEND_ID,
  DAILY_COMPLETION_FIXTURE_USER_ID,
  type TodoSeed,
} from "#test/fixtures/insights/daily-completion.fixture";

const USER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID);

// 같은 날 색 순서는 저장소마다 다를 수 있어(SQL GROUP BY) 정렬해 비교한다
function summariesOf(completions: readonly DailyCompletion[]) {
  return completions.map((completion) => ({
    date: completion.date.toString(),
    totalTodos: completion.totalTodos,
    completedTodos: completion.completedTodos,
    categoryColors: completion.categoryColors.toSorted(),
  }));
}

function todo(startDate: string, overrides: Partial<TodoSeed> = {}): TodoSeed {
  return createTodoSeedFixture({ startDate: calendarDate(startDate), ...overrides });
}

function span(startDate: string, endDate: string, overrides: Partial<TodoSeed> = {}): TodoSeed {
  return todo(startDate, { endDate: calendarDate(endDate), ...overrides });
}

export function describeDailyCompletionRepositoryContract(
  createRepository: (todos: readonly TodoSeed[]) => Promise<DailyCompletionRepositoryPort>,
): void {
  describe("일일 완료 저장소 계약", () => {
    it("구간 양끝 날짜를 포함해 날짜 오름차순으로 세고 구간 밖과 다른 사용자의 할 일은 뺀다", async () => {
      // Given
      const repository = await createRepository([
        todo("2026-01-31", { completed: true }),
        todo("2026-01-31", { categoryColor: "#4A90D9" }),
        todo("2026-01-01", { completed: true }),
        todo("2026-01-01", { completed: true }),
        todo("2025-12-31", { completed: true }),
        todo("2026-02-01", { completed: true }),
        todo("2026-01-15", { userId: DAILY_COMPLETION_FIXTURE_FRIEND_ID }),
      ]);

      // When
      const completions = await repository.listByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-01-01", "2026-01-31"),
      });

      // Then
      expect(summariesOf(completions)).toEqual([
        { date: "2026-01-01", totalTodos: 2, completedTodos: 2, categoryColors: ["#FF6B43"] },
        {
          date: "2026-01-31",
          totalTodos: 2,
          completedTodos: 1,
          categoryColors: ["#4A90D9", "#FF6B43"],
        },
      ]);
    });

    it("친구에게 보이는 조회는 공개 할 일만 센다", async () => {
      // Given
      const repository = await createRepository([
        todo("2026-01-15", { completed: true }),
        todo("2026-01-15", { isPublic: false }),
      ]);

      // When
      const completions = await repository.listPublicByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-01-01", "2026-01-31"),
      });

      // Then
      expect(summariesOf(completions)).toEqual([
        { date: "2026-01-15", totalTodos: 1, completedTodos: 1, categoryColors: ["#FF6B43"] },
      ]);
    });

    it("할 일이 없는 구간은 빈 목록이다", async () => {
      // Given
      const repository = await createRepository([todo("2026-03-01")]);

      // When
      const completions = await repository.listByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-01-01", "2026-01-31"),
      });

      // Then
      expect(completions).toEqual([]);
    });

    it("여러 날 할 일은 시작일에만 세고 구간과 겹치는 기간을 따로 준다", async () => {
      // Given
      const repository = await createRepository([
        span("2025-12-30", "2026-01-02"),
        span("2026-01-30", "2026-02-03", { completed: true }),
        span("2025-12-01", "2025-12-31"),
        span("2026-02-01", "2026-02-03"),
        span("2026-01-10", "2026-01-10"),
        span("2026-01-20", "2026-01-22", { isPublic: false }),
      ]);
      const query = { userId: USER, range: createDateRangeFixture("2026-01-01", "2026-01-31") };

      // When
      const completions = await repository.listByDateRange(query);
      const spans = await repository.listMultiDayTodoSpans(query);
      const publicSpans = await repository.listPublicMultiDayTodoSpans(query);

      // Then
      expect(summariesOf(completions).map(({ date, totalTodos }) => [date, totalTodos])).toEqual([
        ["2026-01-10", 1],
        ["2026-01-20", 1],
        ["2026-01-30", 1],
      ]);
      const toPair = (value: { startDate: Temporal.PlainDate; endDate: Temporal.PlainDate }) => [
        value.startDate.toString(),
        value.endDate.toString(),
      ];
      expect(spans.map(toPair).toSorted()).toEqual([
        ["2025-12-30", "2026-01-02"],
        ["2026-01-20", "2026-01-22"],
        ["2026-01-30", "2026-02-03"],
      ]);
      expect(publicSpans.map(toPair).toSorted()).toEqual([
        ["2025-12-30", "2026-01-02"],
        ["2026-01-30", "2026-02-03"],
      ]);
    });
  });
}
