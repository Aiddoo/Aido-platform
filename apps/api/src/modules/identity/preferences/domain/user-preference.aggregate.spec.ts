import { UserPreference } from "./user-preference.aggregate.js";

const yesterday = Temporal.PlainDate.from("2026-12-31");
const today = Temporal.PlainDate.from("2027-01-01");

describe("UserPreference — 스트릭 전이와 저장 비교 상태", () => {
  it("연말 다음 날 새해 완료도 연속 완료로 이어 가고 저장 비교 상태는 그대로다", () => {
    // Given
    const preference = UserPreference.reconstitute({
      userId: "user-1",
      currentStreak: 2,
      longestStreak: 4,
      lastCompletedDate: yesterday,
    });

    // When
    const plan = preference.planTodoCompletion(today);

    // Then
    expect(preference.streakState).toEqual({
      currentStreak: 2,
      longestStreak: 4,
      lastCompletedDate: yesterday,
    });
    expect(plan?.nextState).toEqual({
      currentStreak: 3,
      longestStreak: 4,
      lastCompletedDate: today,
    });
    expect(plan?.reachedStreak3).toBe(true);
  });
});
