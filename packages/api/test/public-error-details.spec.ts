import { describe, expect, it } from "vitest";

import { ErrorCode, toPublicErrorDetails } from "../src/errors/index.js";

describe("toPublicErrorDetails", () => {
  it("친구 한도 초과는 current·limit만 남기고 다른 키는 버린다", () => {
    // Given
    const details = { current: 6, limit: 6, userId: "secret" };

    // When
    const result = toPublicErrorDetails(ErrorCode.FOLLOW_0909, details);

    // Then
    expect(result).toEqual({ current: 6, limit: 6 });
  });

  it.each([
    { name: "공개 상세가 없는 코드", code: ErrorCode.FOLLOW_0905, details: { targetUserId: "u1" } },
    {
      name: "한도가 0인 잘못된 값",
      code: ErrorCode.FOLLOW_0909,
      details: { current: 0, limit: 0 },
    },
  ])("$name은 상세를 싣지 않는다", ({ code, details }) => {
    // Given
    const input = details;

    // When
    const result = toPublicErrorDetails(code, input);

    // Then
    expect(result).toBeUndefined();
  });
});
