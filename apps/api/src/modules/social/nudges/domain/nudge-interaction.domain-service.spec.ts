import { isNudgeInteractionAvailable } from "./nudge-interaction.domain-service.js";

describe("isNudgeInteractionAvailable — 답장·감사 가능 여부", () => {
  it.each([
    { isMutualFriend: true, todoOwnerId: "receiver", todoVisibility: "PUBLIC", expected: true },
    { isMutualFriend: false, todoOwnerId: "receiver", todoVisibility: "PUBLIC", expected: false },
    { isMutualFriend: true, todoOwnerId: "other", todoVisibility: "PUBLIC", expected: false },
    { isMutualFriend: true, todoOwnerId: "receiver", todoVisibility: "PRIVATE", expected: false },
  ])(
    "친구 $isMutualFriend·소유자 $todoOwnerId·공개 범위 $todoVisibility이면 $expected",
    ({ expected, ...context }) => {
      // When
      const isAvailable = isNudgeInteractionAvailable({ receiverId: "receiver", ...context });

      // Then
      expect(isAvailable).toBe(expected);
    },
  );
});
