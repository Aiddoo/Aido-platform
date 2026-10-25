import { describe, expect, it } from "vitest";

import { canProcessRequestedAi, canProcessScheduledAi } from "./ai-data-sharing-consent.policy.js";

describe("AI 데이터 처리 동의 정책", () => {
  it.each([
    { appVersion: "1.13.0", decision: "AGREED", expected: true },
    { appVersion: "1.13.0", decision: "UNDECIDED", expected: false },
    { appVersion: "1.14.2", decision: "DECLINED", expected: false },
    { appVersion: "1.12.1", decision: "UNDECIDED", expected: true },
    { appVersion: "1.12.1", decision: "DECLINED", expected: false },
    { appVersion: undefined, decision: "UNDECIDED", expected: true },
    { appVersion: "1.13.0-rc.1", decision: "UNDECIDED", expected: true },
  ] as const)(
    "$appVersion 앱의 $decision 사용자 요청은 처리 여부가 $expected다",
    ({ appVersion, decision, expected }) => {
      // When
      const allowed = canProcessRequestedAi(decision, appVersion);

      // Then
      expect(allowed).toBe(expected);
    },
  );

  it.each([
    { decision: "AGREED", expected: true },
    { decision: "UNDECIDED", expected: true },
    { decision: "DECLINED", expected: false },
  ] as const)(
    "예약 작업은 $decision 사용자에게 AI를 쓸지 $expected로 정한다",
    ({ decision, expected }) => {
      expect(canProcessScheduledAi(decision)).toBe(expected);
    },
  );
});
