import { AI_DATA_SHARING_CONSENT } from "@aido/api/vocabulary";
import { describe, expect, it } from "vitest";

import { resolveAiDataSharingConsent } from "./ai-data-sharing-consent.domain-service.js";

const RELEASED_VERSION = "2026-10-26";
const agreedAt = Temporal.Instant.from("2026-10-26T09:00:00.000Z");

describe("resolveAiDataSharingConsent", () => {
  it.each([
    {
      name: "동의 기록이 없으면",
      consent: null,
      expected: { decision: "UNDECIDED", agreedVersion: null },
    },
    {
      name: "안내에 답한 적이 없으면",
      consent: { aiDataSharingAgreedAt: null, aiDataSharingVersion: null },
      expected: { decision: "UNDECIDED", agreedVersion: null },
    },
    {
      name: "현재 안내에 동의했으면",
      consent: {
        aiDataSharingAgreedAt: agreedAt,
        aiDataSharingVersion: AI_DATA_SHARING_CONSENT.VERSION,
      },
      expected: { decision: "AGREED", agreedVersion: AI_DATA_SHARING_CONSENT.VERSION },
    },
    {
      name: "출시 앱(1.13·1.14)의 이전 안내에 동의했으면 다시 묻지 않고 그 버전으로",
      consent: { aiDataSharingAgreedAt: agreedAt, aiDataSharingVersion: RELEASED_VERSION },
      expected: { decision: "AGREED", agreedVersion: RELEASED_VERSION },
    },
    {
      name: "지원하지 않는 안내에만 동의했으면 다시 물어야 하므로",
      consent: { aiDataSharingAgreedAt: agreedAt, aiDataSharingVersion: "2026-01-01" },
      expected: { decision: "UNDECIDED", agreedVersion: null },
    },
    {
      name: "이전 안내에서 거부했으면 버전이 바뀌어도",
      consent: { aiDataSharingAgreedAt: null, aiDataSharingVersion: "2026-01-01" },
      expected: { decision: "DECLINED", agreedVersion: null },
    },
  ] as const)("$name $expected.decision다", ({ consent, expected }) => {
    // When
    const status = resolveAiDataSharingConsent(consent);

    // Then
    expect(status).toEqual(expected);
  });
});
