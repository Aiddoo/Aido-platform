import { weeklyAchievementBadge } from "../src/vocabulary/index.js";

describe("weeklyAchievementBadge", () => {
  it.each([
    { name: "모두 끝낸 주", completed: 10, total: 10, expected: "perfect" },
    { name: "반올림하면 100%여도 하나 남은 주", completed: 199, total: 200, expected: "almost" },
    { name: "딱 90%인 주", completed: 9, total: 10, expected: "almost" },
    { name: "반올림해 90%가 되는 주", completed: 179, total: 199, expected: "almost" },
    { name: "반올림해도 89%인 주", completed: 17, total: 19, expected: "completed" },
    { name: "하나도 끝내지 않은 주", completed: 0, total: 5, expected: "completed" },
    { name: "할 일이 없는 주", completed: 0, total: 0, expected: "completed" },
  ])("$name($completed/$total)은 $expected다", ({ completed, total, expected }) => {
    // When
    const badge = weeklyAchievementBadge(completed, total);

    // Then
    expect(badge).toBe(expected);
  });
});
