import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

import { isBusinessRejection } from "./business-rejection.js";

describe("isBusinessRejection — 업무 거부와 장애 가르기", () => {
  it.each([
    {
      name: "없는 구독 사용자(404)",
      error: new ApplicationException(ErrorCode.SUBSCRIPTION_1602),
      expected: true,
    },
    { name: "도메인 불변식 위반", error: new DomainException(ErrorCode.SYS_0002), expected: true },
    {
      name: "업체 장애로 분류한 503",
      error: new ApplicationException(ErrorCode.AI_1301),
      expected: false,
    },
    {
      name: "분류되지 않은 500",
      error: new ApplicationException(ErrorCode.SYS_0001),
      expected: false,
    },
    { name: "일반 예외", error: new TypeError("boom"), expected: false },
  ])("$name → $expected", ({ error, expected }) => {
    // When
    const rejected = isBusinessRejection(error);

    // Then
    expect(rejected).toBe(expected);
  });
});
