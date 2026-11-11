import {
  decideNudgeThanksPreviewScope,
  isNudgeInteractionAvailable,
  judgeNudgeThanks,
} from "./nudge-interaction.domain-service.js";

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

describe("감사 판단 — 전하기와 미리보기", () => {
  it.each([
    {
      isTodoCompleted: false,
      todoVisibility: "PRIVATE" as const,
      judgement: { ok: false, reason: "todo-not-completed" },
      scope: "none",
    },
    {
      isTodoCompleted: false,
      todoVisibility: "PUBLIC" as const,
      judgement: { ok: false, reason: "todo-not-completed" },
      scope: "none",
    },
    {
      isTodoCompleted: true,
      todoVisibility: "PRIVATE" as const,
      judgement: { ok: false, reason: "todo-not-public" },
      scope: "summary",
    },
    {
      isTodoCompleted: true,
      todoVisibility: "PUBLIC" as const,
      judgement: { ok: true },
      scope: "recipients",
    },
  ])(
    "완료 $isTodoCompleted·공개 범위 $todoVisibility이면 전하기는 $judgement.reason, 미리보기는 $scope",
    ({ judgement, scope, ...todo }) => {
      // When
      const sendJudgement = judgeNudgeThanks(todo);
      const previewScope = decideNudgeThanksPreviewScope(todo);

      // Then
      expect(sendJudgement).toEqual(judgement);
      expect(previewScope).toBe(scope);
    },
  );
});
