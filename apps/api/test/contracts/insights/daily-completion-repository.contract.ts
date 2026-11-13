import type { DailyCompletionRepositoryPort } from "#api/modules/insights/daily-completions/application/ports/daily-completion.repository.port";
import type { DailyCompletion } from "#api/modules/insights/daily-completions/domain/daily-completion.aggregate";
import { DateRange } from "#api/modules/insights/daily-completions/domain/date-range.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";
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

function countsOf(completions: readonly DailyCompletion[]) {
  return completions.map((completion) => [
    completion.date.toString(),
    completion.totalTodos,
    completion.completedTodos,
  ]);
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

    it("여러 날 할 일은 시작 전 날에는 없고 시작일·기간 안·종료일에 모두 세며 종료 다음 날에는 없다", async () => {
      // Given
      const repository = await createRepository([
        span("2026-01-28", "2026-01-30", { completed: true }),
        todo("2026-01-29"),
      ]);

      // When
      const completions = await repository.listByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-01-26", "2026-02-02"),
      });

      // Then
      expect(countsOf(completions)).toEqual([
        ["2026-01-28", 1, 1],
        ["2026-01-29", 2, 1],
        ["2026-01-30", 1, 1],
      ]);
    });

    it("하루짜리 할 일과 시작일·종료일이 같은 할 일은 그날에만 센다", async () => {
      // Given
      const repository = await createRepository([
        todo("2026-01-15", { completed: true }),
        span("2026-01-20", "2026-01-20"),
      ]);

      // When
      const completions = await repository.listByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-01-14", "2026-01-21"),
      });

      // Then
      expect(countsOf(completions)).toEqual([
        ["2026-01-15", 1, 1],
        ["2026-01-20", 1, 0],
      ]);
    });

    it("월 경계에 걸친 할 일은 앞 달 조회의 말일과 다음 달 조회의 1일에 모두 센다", async () => {
      // Given
      const repository = await createRepository([span("2026-11-30", "2026-12-01")]);

      // When
      const november = await repository.listByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-11-01", "2026-11-30"),
      });
      const december = await repository.listByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-12-01", "2026-12-31"),
      });

      // Then
      expect(countsOf(november)).toEqual([["2026-11-30", 1, 0]]);
      expect(countsOf(december)).toEqual([["2026-12-01", 1, 0]]);
    });

    it("서울과 LA가 다른 날짜를 보는 같은 순간에도 각자 앱이 보낸 달력 날짜에 센다", async () => {
      // Given
      const repository = await createRepository([span("2026-11-30", "2026-12-01")]);
      const instant = Temporal.Instant.from("2026-11-30T16:30:00Z");
      const seoulToday = localDateOf(instant, TimeZone.SEOUL);
      const laToday = localDateOf(instant, TimeZone.create("America/Los_Angeles"));

      // When
      const seoul = await repository.listByDateRange({
        userId: USER,
        range: DateRange.create(seoulToday, seoulToday),
      });
      const la = await repository.listByDateRange({
        userId: USER,
        range: DateRange.create(laToday, laToday),
      });

      // Then
      expect([seoulToday.toString(), laToday.toString()]).toEqual(["2026-12-01", "2026-11-30"]);
      expect(countsOf(seoul)).toEqual([["2026-12-01", 1, 0]]);
      expect(countsOf(la)).toEqual([["2026-11-30", 1, 0]]);
    });

    it("끝이 아주 먼 할 일도 조회 구간 안의 날만 펼친다", async () => {
      // Given
      const repository = await createRepository([
        span("2020-01-01", "2099-12-31", { completed: true }),
      ]);

      // When
      const completions = await repository.listByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-02-01", "2026-02-28"),
      });

      // Then
      expect(completions).toHaveLength(28);
      expect(countsOf(completions).at(0)).toEqual(["2026-02-01", 1, 1]);
      expect(countsOf(completions).at(-1)).toEqual(["2026-02-28", 1, 1]);
    });

    it("친구 조회도 공개 여러 날 할 일만 기간의 모든 날에 세고 다른 사용자의 할 일은 섞지 않는다", async () => {
      // Given
      const repository = await createRepository([
        span("2026-01-05", "2026-01-06", { completed: true }),
        span("2026-01-05", "2026-01-07", { isPublic: false }),
        span("2026-01-05", "2026-01-06", { userId: DAILY_COMPLETION_FIXTURE_FRIEND_ID }),
      ]);

      // When
      const completions = await repository.listPublicByDateRange({
        userId: USER,
        range: createDateRangeFixture("2026-01-01", "2026-01-31"),
      });

      // Then
      expect(countsOf(completions)).toEqual([
        ["2026-01-05", 1, 1],
        ["2026-01-06", 1, 1],
      ]);
    });
  });
}
