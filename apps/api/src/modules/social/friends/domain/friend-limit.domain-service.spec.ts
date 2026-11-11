import { hasReachedFriendLimit } from "./friend-limit.domain-service.js";

describe("hasReachedFriendLimit", () => {
  it.each([
    { maxFriendCount: null, friendCount: 1000, expected: false },
    { maxFriendCount: 5, friendCount: 4, expected: false },
    { maxFriendCount: 5, friendCount: 5, expected: true },
    { maxFriendCount: 5, friendCount: 6, expected: true },
  ])(
    "한도 $maxFriendCount에 친구 $friendCount명이면 $expected다",
    ({ maxFriendCount, friendCount, expected }) => {
      // When
      const isReached = hasReachedFriendLimit({ maxFriendCount, friendCount });

      // Then
      expect(isReached).toBe(expected);
    },
  );
});
