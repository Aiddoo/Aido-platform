import { ErrorCode } from "@aido/api/errors";

import {
  AI_FAILURE_KINDS,
  isTransientAiFailure,
  resolveAiFailureRule,
} from "./ai-generation.errors.js";

describe("resolveAiFailureRule", () => {
  it.each([
    {
      kind: "QUOTA_EXHAUSTED",
      shouldFallback: true,
      retry: false,
      breaker: "billing",
      code: ErrorCode.AI_1301,
    },
    { kind: "AUTH", shouldFallback: true, retry: false, breaker: "auth", code: ErrorCode.AI_1301 },
    {
      kind: "RATE_LIMITED",
      shouldFallback: true,
      retry: false,
      breaker: null,
      code: ErrorCode.AI_1310,
    },
    {
      kind: "OVERLOADED",
      shouldFallback: true,
      retry: false,
      breaker: "health",
      code: ErrorCode.AI_1301,
    },
    {
      kind: "UPSTREAM",
      shouldFallback: true,
      retry: false,
      breaker: "health",
      code: ErrorCode.AI_1301,
    },
    {
      kind: "TIMEOUT",
      shouldFallback: true,
      retry: false,
      breaker: "health",
      code: ErrorCode.AI_1301,
    },
    {
      kind: "BAD_REQUEST",
      shouldFallback: true,
      retry: false,
      breaker: null,
      code: ErrorCode.AI_1302,
    },
    {
      kind: "BLOCKED",
      shouldFallback: false,
      retry: false,
      breaker: null,
      code: ErrorCode.AI_1302,
    },
    {
      kind: "TRUNCATED",
      shouldFallback: false,
      retry: false,
      breaker: null,
      code: ErrorCode.AI_1302,
    },
    {
      kind: "INVALID_OUTPUT",
      shouldFallback: true,
      retry: true,
      breaker: null,
      code: ErrorCode.AI_1302,
    },
    {
      kind: "UNAVAILABLE",
      shouldFallback: true,
      retry: false,
      breaker: null,
      code: ErrorCode.AI_1301,
    },
  ] as const)(
    "$kind는 폴백 $shouldFallback·재질문 $retry·회로 $breaker·응답 $code다",
    ({ kind, shouldFallback, retry, breaker, code }) => {
      // When
      const rule = resolveAiFailureRule(kind);
      // Then
      expect(rule).toEqual({
        shouldFallback,
        shouldRetrySameProvider: retry,
        breaker,
        errorCode: code,
      });
    },
  );

  it("잡이 다시 시도할 일시 실패는 요청 한도·장애 회로 종류와 열린 회로뿐이다", () => {
    // When
    const transient = AI_FAILURE_KINDS.filter((kind) => isTransientAiFailure(kind));
    // Then
    expect(transient).toEqual([
      "RATE_LIMITED",
      "OVERLOADED",
      "UPSTREAM",
      "TIMEOUT",
      "CIRCUIT_OPEN",
    ]);
  });
});
