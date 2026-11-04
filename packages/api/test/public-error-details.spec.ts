import { describe, expect, it } from "vitest";

import {
  ErrorCode,
  friendLimitErrorDetailsSchema,
  toPublicErrorDetails,
} from "../src/errors/index.js";

const featureQuota = {
  feature: "AI_PARSE",
  allowed: true,
  limit: 10,
  used: 10,
  remaining: 0,
  period: "month",
  resetsAt: "2026-11-30T15:00:00.000Z",
  isFairUse: false,
  perUse: null,
} as const;

describe("toPublicErrorDetails", () => {
  it("친구 한도 초과는 출시 앱의 current·limit에 차감 없음과 featureQuota를 더해 남긴다", () => {
    // Given
    const friendQuota = {
      ...featureQuota,
      feature: "FRIEND",
      limit: 6,
      used: 6,
      period: null,
      resetsAt: null,
    };
    const details = {
      current: 6,
      limit: 6,
      charged: false,
      featureQuota: friendQuota,
      userId: "secret",
    };

    // When
    const result = toPublicErrorDetails(ErrorCode.FOLLOW_0909, details);

    // Then
    expect(result).toEqual({ current: 6, limit: 6, charged: false, featureQuota: friendQuota });
    expect(friendLimitErrorDetailsSchema.parse(result)).toEqual({ current: 6, limit: 6 });
  });

  it.each([
    ErrorCode.AI_1303,
    ErrorCode.AI_1313,
    ErrorCode.AI_1314,
    ErrorCode.TODO_CATEGORY_0857,
    ErrorCode.NUDGE_1101,
    ErrorCode.CHEER_1201,
  ])("%s 한도 오류는 차감 없음과 서버가 계산한 featureQuota만 남긴다", (code) => {
    // Given
    const details = { charged: false, featureQuota, userId: "secret" };

    // When
    const result = toPublicErrorDetails(code, details);

    // Then
    expect(result).toEqual({ charged: false, featureQuota });
  });

  it.each([
    { name: "공개 상세가 없는 코드", code: ErrorCode.FOLLOW_0905, details: { targetUserId: "u1" } },
    {
      name: "한도가 0인 잘못된 값",
      code: ErrorCode.FOLLOW_0909,
      details: { current: 0, limit: 0, charged: false, featureQuota },
    },
    {
      name: "featureQuota가 없는 친구 한도 오류",
      code: ErrorCode.FOLLOW_0909,
      details: { current: 6, limit: 6 },
    },
    {
      name: "featureQuota가 없는 일일 한도 오류",
      code: ErrorCode.CHEER_1201,
      details: { limit: 3 },
    },
    {
      name: "차감했다고 표시한 한도 오류",
      code: ErrorCode.AI_1303,
      details: { charged: true, featureQuota },
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
