import { completionRate, isAllCompleted } from "../src/vocabulary/completion-rate.js";

describe("completionRate", () => {
  it.each([
    { completed: 0, total: 0, expected: 0, reason: "할 일이 없으면 0" },
    { completed: 0, total: 5, expected: 0, reason: "하나도 끝내지 않았으면 0" },
    { completed: 5, total: 5, expected: 100, reason: "모두 끝냈으면 100" },
    { completed: 199, total: 200, expected: 99, reason: "하나라도 남았으면 반올림해도 99" },
    { completed: 1, total: 300, expected: 1, reason: "하나라도 끝냈으면 반올림해도 1" },
    { completed: 1, total: 3, expected: 33, reason: "그 밖에는 반올림" },
    { completed: 2, total: 3, expected: 67, reason: "그 밖에는 반올림" },
  ])("$completed/$total → $expected ($reason)", ({ completed, total, expected }) => {
    // When
    const rate = completionRate(completed, total);

    // Then
    expect(rate).toBe(expected);
  });
});

describe("isAllCompleted", () => {
  it.each([
    { completed: 0, total: 0, expected: false, reason: "할 일이 없는 날은 끝낸 날이 아니다" },
    { completed: 2, total: 3, expected: false, reason: "하나라도 남았다" },
    { completed: 3, total: 3, expected: true, reason: "모두 끝냈다" },
  ])("$completed/$total → $expected ($reason)", ({ completed, total, expected }) => {
    // When
    const result = isAllCompleted(completed, total);

    // Then
    expect(result).toBe(expected);
  });
});
