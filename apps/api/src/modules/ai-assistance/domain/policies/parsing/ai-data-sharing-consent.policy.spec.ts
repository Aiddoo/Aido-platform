import { describe, expect, it } from "vitest";

import { canShareWithAi } from "./ai-data-sharing-consent.policy.js";

describe("AI 데이터 처리 동의 정책", () => {
  it.each([
    { appVersion: "1.13.0", decision: "AGREED", expected: true },
    { appVersion: "1.13.0", decision: "UNDECIDED", expected: false },
    { appVersion: "1.14.2", decision: "DECLINED", expected: false },
    { appVersion: "1.12.1", decision: "AGREED", expected: true },
    { appVersion: "1.12.1", decision: "UNDECIDED", expected: true },
    { appVersion: "1.12.1", decision: "DECLINED", expected: false },
    { appVersion: undefined, decision: "UNDECIDED", expected: true },
    { appVersion: null, decision: "DECLINED", expected: false },
    { appVersion: "1.13.0-rc.1", decision: "UNDECIDED", expected: true },
  ] as const)(
    "$appVersion 앱의 $decision 사용자 데이터를 AI로 보낼지는 $expected다",
    ({ appVersion, decision, expected }) => {
      // When
      const allowed = canShareWithAi(decision, appVersion);

      // Then
      expect(allowed).toBe(expected);
    },
  );
});
