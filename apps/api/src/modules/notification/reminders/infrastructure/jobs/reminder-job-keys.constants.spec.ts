import { todoReminderJobKey } from "./reminder-job-keys.constants.js";

describe("리마인더 작업 key", () => {
  it("리마인더 key는 이전 배포가 예약한 작업을 취소할 수 있도록 형식을 유지한다", () => {
    // When
    const key = todoReminderJobKey(42, "10min");

    // Then
    expect(key).toBe("reminder_42_10min");
  });
});
