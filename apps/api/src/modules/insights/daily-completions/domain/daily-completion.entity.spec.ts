import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  calendarDate,
  createDailyCompletionFixture,
  DAILY_COMPLETION_FIXTURE_USER_ID,
} from "#test/fixtures/insights/daily-completion.fixture";

import { DailyCompletion } from "./daily-completion.entity.js";

describe("DailyCompletion", () => {
  it.each([
    { totalTodos: 3, completedTodos: 3, isComplete: true, completionRate: 100 },
    { totalTodos: 3, completedTodos: 2, isComplete: false, completionRate: 67 },
    { totalTodos: 0, completedTodos: 0, isComplete: false, completionRate: 0 },
  ])(
    "$completedTodos/$totalTodos 날은 완료일 $isComplete, 완료율 $completionRate",
    ({ totalTodos, completedTodos, isComplete, completionRate }) => {
      // Given
      const completion = createDailyCompletionFixture({ totalTodos, completedTodos });

      // When
      const result = {
        isComplete: completion.isComplete,
        completionRate: completion.completionRate,
      };

      // Then
      expect(result).toEqual({ isComplete, completionRate });
    },
  );

  it("완료 수가 전체보다 많으면 SYS_0002로 거절한다", () => {
    // When
    const creating = () =>
      DailyCompletion.create({
        userId: UserId.reconstitute(DAILY_COMPLETION_FIXTURE_USER_ID),
        date: calendarDate("2028-02-29"),
        totalTodos: 1,
        completedTodos: 2,
        categoryColors: [],
      });

    // Then
    expect(creating).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.SYS_0002,
        details: { field: "completedTodos", completedTodos: 2, totalTodos: 1 },
      }),
    );
  });
});
