import { describe, expect, it } from "vitest";

import { createUserReportSchema } from "../src/index.js";

const targetUserId = "clz7x5p8k0005qz0z8z8z8z8z";

describe("createUserReportSchema", () => {
  it("댓글 신고는 콘텐츠 ID와 함께 받고 상세 내용의 앞뒤 공백을 지운다", () => {
    // Given
    const input = {
      targetUserId,
      targetType: "COMMENT",
      targetId: "clz7x5p8k0099qz0z8z8z8z8z",
      reason: "HARASSMENT",
      detail: "  계속 욕설을 해요.  ",
    };

    // When
    const result = createUserReportSchema.parse(input);

    // Then
    expect(result.detail).toBe("계속 욕설을 해요.");
  });

  it("콘텐츠 신고에 콘텐츠 ID가 없으면 거부한다", () => {
    // Given
    const input = { targetUserId, targetType: "NUDGE_MESSAGE", reason: "SPAM" };

    // When
    const result = createUserReportSchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["targetId"]]);
  });

  it("프로필 신고에 콘텐츠 ID를 함께 보내면 거부한다", () => {
    // Given
    const input = { targetUserId, targetType: "PROFILE", targetId: "12", reason: "IMPERSONATION" };

    // When
    const result = createUserReportSchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });

  it("프로필 신고는 콘텐츠 ID 없이 받는다", () => {
    // Given
    const input = { targetUserId, targetType: "PROFILE", reason: "IMPERSONATION" };

    // When
    const result = createUserReportSchema.safeParse(input);

    // Then
    expect(result.success).toBe(true);
  });
});
