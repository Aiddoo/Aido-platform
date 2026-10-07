import { UserPreference } from "./user-preference.aggregate.js";

const yesterday = new Date("2026-12-31T00:00:00.000Z");
const today = new Date("2027-01-01T00:00:00.000Z");

describe("UserPreference — 스트릭 전이와 저장 비교 상태", () => {
  it("복원 입력과 CAS snapshot의 Date 변경으로 연속 완료 판단이 바뀌지 않는다", () => {
    // Given
    const state = { currentStreak: 2, longestStreak: 4, lastCompletedDate: new Date(yesterday) };
    const preference = UserPreference.reconstitute(state);

    // When
    state.lastCompletedDate.setUTCDate(1);
    preference.streakState.lastCompletedDate?.setUTCDate(1);
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
