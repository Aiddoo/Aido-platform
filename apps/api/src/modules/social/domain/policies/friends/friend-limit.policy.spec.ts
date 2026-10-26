import { hasReachedFriendLimit } from "./friend-limit.policy.js";

describe("hasReachedFriendLimit", () => {
  it.each([
    { maxCount: null, friendCount: 1_000, expected: false },
    { maxCount: 5, friendCount: 4, expected: false },
    { maxCount: 5, friendCount: 5, expected: true },
    { maxCount: 5, friendCount: 6, expected: true },
  ])(
    "한도 $maxCount에 친구 $friendCount명이면 $expected다",
    ({ maxCount, friendCount, expected }) => {
      // Given
      const limit = maxCount;

      // When
      const reached = hasReachedFriendLimit(limit, friendCount);

      // Then
      expect(reached).toBe(expected);
    },
  );
});
