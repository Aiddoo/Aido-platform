import { readFileSync } from "node:fs";

import { z } from "zod";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  calendarDate,
  createDailyCompletionFixture,
  createDateRangeFixture,
  DAILY_COMPLETION_FIXTURE_USER_ID,
} from "#test/fixtures/insights/daily-completion.fixture";

import { countCompleteDays, tallyDailyCompletions } from "./daily-completion.domain-service.js";

const USER = UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID);

/** 앱 withTodoDailyCompletion도 같은 표를 읽는다. 앱은 하루를 고친 뒤 이 값으로 달력을 고치고 다시 받지 않는다 */
const SHARED_DAY_TALLY_CASES = z
  .object({
    dayTally: z.array(
      z.object({
        name: z.string(),
        date: z.iso.date(),
        todos: z.array(
          z.object({
            startDate: z.iso.date(),
            endDate: z.iso.date().nullable(),
            completed: z.boolean(),
            categoryColor: z.string(),
          }),
        ),
        expected: z
          .object({
            totalTodos: z.int(),
            completedTodos: z.int(),
            isComplete: z.boolean(),
            completionRate: z.number(),
            categoryColors: z.array(z.string()),
          })
          .nullable(),
      }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../../packages/api/test/fixtures/daily-completion-cases.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  ).dayTally;

describe("일일 완료 집계", () => {
  it("구간 안 하루짜리 할 일을 날짜마다 할 일 수·완료 수·색(중복 없이)으로 더하고 날짜 오름차순으로 준다", () => {
    // Given
    const groups = [
      {
        startDate: calendarDate("2028-02-29"),
        endDate: null,
        completed: true,
        categoryColor: "#123456",
        todoCount: 2,
      },
      {
        startDate: calendarDate("2028-02-01"),
        endDate: null,
        completed: false,
        categoryColor: null,
        todoCount: 1,
      },
      {
        startDate: calendarDate("2028-02-29"),
        endDate: null,
        completed: false,
        categoryColor: "#654321",
        todoCount: 1,
      },
      {
        startDate: calendarDate("2028-02-29"),
        endDate: null,
        completed: false,
        categoryColor: "#123456",
        todoCount: 1,
      },
      {
        startDate: calendarDate("2028-03-01"),
        endDate: null,
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
      endDate: null,
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
    expect(completion?.toPrimitives().categoryColors).toEqual(["#00AA00", "#FF6B43", "#FFB3B3"]);
  });

  it.each([
    { name: "시작 전 날", day: "2028-02-27", counted: false },
    { name: "시작일", day: "2028-02-28", counted: true },
    { name: "기간 안(윤일)", day: "2028-02-29", counted: true },
    { name: "종료일", day: "2028-03-01", counted: true },
    { name: "종료 다음 날", day: "2028-03-02", counted: false },
  ])("여러 날 할 일은 $name에 세는지: $counted", ({ day, counted }) => {
    // Given
    const group = {
      startDate: calendarDate("2028-02-28"),
      endDate: calendarDate("2028-03-01"),
      completed: false,
      categoryColor: "#123456",
      todoCount: 1,
    };

    // When
    const completions = tallyDailyCompletions({
      userId: USER,
      range: createDateRangeFixture(day, day),
      groups: [group],
    });

    // Then
    expect(completions.length === 1).toBe(counted);
  });

  it("종료일이 시작일보다 앞선 기간은 어느 날에도 세지 않는다", () => {
    // Given
    const group = {
      startDate: calendarDate("2028-03-01"),
      endDate: calendarDate("2028-02-28"),
      completed: false,
      categoryColor: null,
      todoCount: 1,
    };

    // When
    const completions = tallyDailyCompletions({
      userId: USER,
      range: createDateRangeFixture("2028-02-01", "2028-03-31"),
      groups: [group],
    });

    // Then
    expect(completions).toEqual([]);
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

  it.each(SHARED_DAY_TALLY_CASES)("앱과 같은 하루 집계 표: $name", ({ date, todos, expected }) => {
    // Given
    const groups = todos.map((todo) => ({
      startDate: calendarDate(todo.startDate),
      endDate: todo.endDate == null ? null : calendarDate(todo.endDate),
      completed: todo.completed,
      categoryColor: todo.categoryColor,
      todoCount: 1,
    }));

    // When
    const completions = tallyDailyCompletions({
      userId: USER,
      range: createDateRangeFixture(date, date),
      groups,
    }).map((completion) => {
      const primitives = completion.toPrimitives();
      return {
        date: primitives.date.toString(),
        totalTodos: primitives.totalTodos,
        completedTodos: primitives.completedTodos,
        isComplete: completion.isComplete(),
        completionRate: completion.completionRate,
        categoryColors: primitives.categoryColors,
      };
    });

    // Then
    expect(completions).toEqual(expected == null ? [] : [{ date, ...expected }]);
  });
});
