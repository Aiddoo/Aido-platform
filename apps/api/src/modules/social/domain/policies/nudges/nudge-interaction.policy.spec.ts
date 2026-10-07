import { describe, expect, it } from "vitest";

import { NudgeInteractionPolicy } from "./nudge-interaction.policy.js";

describe("NudgeInteractionPolicy", () => {
  it.each([
    { isMutualFriend: true, todoOwnerId: "receiver", todoVisibility: "PUBLIC", expected: true },
    { isMutualFriend: false, todoOwnerId: "receiver", todoVisibility: "PUBLIC", expected: false },
    { isMutualFriend: true, todoOwnerId: "other", todoVisibility: "PUBLIC", expected: false },
    { isMutualFriend: true, todoOwnerId: "receiver", todoVisibility: "PRIVATE", expected: false },
  ])(
    "친구 관계 $isMutualFriend·소유자 $todoOwnerId·공개 범위 $todoVisibility로 답장 가능 여부를 판단한다",
    ({ expected, ...context }) => {
      // Given
      const nudge = { receiverId: "receiver" };

      // When
      const result = NudgeInteractionPolicy.isAvailable(nudge, context);

      // Then
      expect(result).toBe(expected);
    },
  );

  it("메서드를 분리해 호출해도 this 바인딩에 의존하지 않는다", () => {
    // Given
    const { isAvailable } = NudgeInteractionPolicy;

    // When
    const result = isAvailable(
      { receiverId: "receiver" },
      { isMutualFriend: true, todoOwnerId: "receiver", todoVisibility: "PUBLIC" },
    );

    // Then
    expect(result).toBe(true);
  });
});
