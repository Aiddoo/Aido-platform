import { describe, expect, it } from "vitest";

import { resolveAiDataSharingDecision } from "./ai-data-sharing-consent-policy.js";

const CURRENT_VERSION = "2026-10-26";
const agreedAt = new Date("2026-10-26T09:00:00.000Z");

describe("resolveAiDataSharingDecision", () => {
  it.each([
    { name: "동의 기록이 없으면", consent: null, expected: "UNDECIDED" },
    {
      name: "안내에 답한 적이 없으면",
      consent: { aiDataSharingAgreedAt: null, aiDataSharingVersion: null },
      expected: "UNDECIDED",
    },
    {
      name: "현재 안내에 동의했으면",
      consent: { aiDataSharingAgreedAt: agreedAt, aiDataSharingVersion: CURRENT_VERSION },
      expected: "AGREED",
    },
    {
      name: "이전 안내에만 동의했으면 다시 물어야 하므로",
      consent: { aiDataSharingAgreedAt: agreedAt, aiDataSharingVersion: "2026-01-01" },
      expected: "UNDECIDED",
    },
    {
      name: "이전 안내에서 거부했으면 버전이 바뀌어도",
      consent: { aiDataSharingAgreedAt: null, aiDataSharingVersion: "2026-01-01" },
      expected: "DECLINED",
    },
  ] as const)("$name $expected다", ({ consent, expected }) => {
    // When
    const decision = resolveAiDataSharingDecision(consent, CURRENT_VERSION);

    // Then
    expect(decision).toBe(expected);
  });
});
