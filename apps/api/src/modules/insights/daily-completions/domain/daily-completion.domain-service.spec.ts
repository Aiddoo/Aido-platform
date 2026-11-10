import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  calendarDate,
  createDailyCompletionFixture,
  createDateRangeFixture,
  DAILY_COMPLETION_FIXTURE_USER_ID,
} from "#test/fixtures/insights/daily-completion.fixture";

import { countCompleteDays, tallyDailyCompletions } from "./daily-completion.domain-service.js";

const USER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID);

describe("일일 완료 집계", () => {
  it("구간 안 시작일마다 할 일 수·완료 수·색(중복 없이)을 더하고 날짜 오름차순으로 준다", () => {
    // Given
    const groups = [
      {
        startDate: calendarDate("2028-02-29"),
        completed: true,
        categoryColor: "#123456",
        todoCount: 2,
      },
      {
        startDate: calendarDate("2028-02-01"),
        completed: false,
        categoryColor: null,
        todoCount: 1,
      },
      {
        startDate: calendarDate("2028-02-29"),
        completed: false,
        categoryColor: "#654321",
        todoCount: 1,
      },
      {
        startDate: calendarDate("2028-02-29"),
        completed: false,
        categoryColor: "#123456",
        todoCount: 1,
      },
      {
        startDate: calendarDate("2028-03-01"),
        completed: true,
        categoryColor: "#000000",
        todoCount: 1,
      },
    ];

    // When
    const completions = tallyDailyCompletions({
      userId: USER,
      range: createDateRangeFixture("2028-02-01", "2028-02-29"),
      groups,
    });

    // Then
    expect(completions.map((completion) => completion.toPrimitives())).toEqual([
      {
        userId: USER.value,
        date: calendarDate("2028-02-01"),
        totalTodos: 1,
        completedTodos: 0,
        categoryColors: [],
      },
      {
        userId: USER.value,
        date: calendarDate("2028-02-29"),
        totalTodos: 4,
        completedTodos: 2,
        categoryColors: ["#123456", "#654321"],
      },
    ]);
  });

  it("카테고리 색은 중복 없이 문자열 오름차순으로 준다(앱 정렬과 같은 순서)", () => {
    // Given
    const groups = ["#FFB3B3", "#00AA00", "#FF6B43", "#00AA00"].map((categoryColor) => ({
      startDate: calendarDate("2028-02-15"),
      completed: false,
      categoryColor,
      todoCount: 1,
    }));

    // When
    const [completion] = tallyDailyCompletions({
      userId: USER,
      range: createDateRangeFixture("2028-02-01", "2028-02-29"),
      groups,
    });

    // Then
    expect(completion?.categoryColors).toEqual(["#00AA00", "#FF6B43", "#FFB3B3"]);
  });

  it("완료일 수는 할 일을 모두 끝낸 날만 센다", () => {
    // Given
    const completions = [
      createDailyCompletionFixture({
        date: calendarDate("2028-02-27"),
        totalTodos: 2,
        completedTodos: 2,
      }),
      createDailyCompletionFixture({
        date: calendarDate("2028-02-28"),
        totalTodos: 2,
        completedTodos: 1,
      }),
      createDailyCompletionFixture({
        date: calendarDate("2028-02-29"),
        totalTodos: 1,
        completedTodos: 1,
      }),
    ];

    // When
    const completeDays = countCompleteDays(completions);

    // Then
    expect(completeDays).toBe(2);
  });
});
