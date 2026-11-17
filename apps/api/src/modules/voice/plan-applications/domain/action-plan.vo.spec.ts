import { ErrorCode } from "@aido/api/errors";
import { MEMO_LIMITS } from "@aido/api/vocabulary";

import { ActionPlan, type PlannedMemo, type PlannedTodo } from "./action-plan.vo.js";

function todo(key: string, categoryId: number): PlannedTodo {
  return {
    type: "CREATE_TODO",
    key,
    title: "할 일",
    categoryId,
    startDate: "2027-01-04",
    endDate: null,
    scheduledTime: null,
    repeat: null,
    visibility: null,
    items: [],
  };
}

function memo(title: string, content: string): PlannedMemo {
  return { type: "CREATE_MEMO", key: "memo-0", title, content };
}

describe("ActionPlan", () => {
  it("내 카테고리가 아닌 id를 겹치지 않게 모아 거절한다", () => {
    // Given
    const plan = ActionPlan.create([todo("a", 1), todo("b", 9), todo("c", 9), todo("d", 8)]);

    // When
    const rejected = () => plan.assertCategoriesOwned(new Set([1]));

    // Then
    expect(rejected).toThrow(
      expect.objectContaining({
        errorCode: ErrorCode.AI_1315,
        details: { reason: "CATEGORY_NOT_OWNED", categoryIds: [9, 8] },
      }),
    );
  });

  it("모든 카테고리가 내 것이면 통과한다", () => {
    // Given
    const plan = ActionPlan.create([todo("a", 1), todo("b", 2)]);

    // When
    const accepted = () => plan.assertCategoriesOwned(new Set([1, 2]));

    // Then
    expect(accepted).not.toThrow();
  });

  it.each([
    { title: "장보기", content: "우유 계란", expected: "장보기\n우유 계란" },
    { title: "", content: "우유 계란", expected: "우유 계란" },
    { title: "우유", content: "우유 계란", expected: "우유 계란" },
  ])("메모 제목 '$title'은 첫 줄에 한 번만 둔다", ({ title, content, expected }) => {
    // Given
    const plan = ActionPlan.create([memo(title, content)]);

    // When
    const composed = plan.memoContent;

    // Then
    expect(composed).toBe(expected);
  });

  it("제목을 붙여 길어진 메모는 메모 상한에 맞춘다", () => {
    // Given
    const plan = ActionPlan.create([memo("제목", "가".repeat(MEMO_LIMITS.MAX_CONTENT_LENGTH))]);

    // When
    const composed = plan.memoContent;

    // Then
    expect(composed?.length).toBeLessThanOrEqual(MEMO_LIMITS.MAX_CONTENT_LENGTH);
  });

  it("메모가 없으면 메모 내용도 없다", () => {
    // Given
    const plan = ActionPlan.create([todo("a", 1)]);

    // When
    const composed = plan.memoContent;

    // Then
    expect(composed).toBeNull();
  });
});
