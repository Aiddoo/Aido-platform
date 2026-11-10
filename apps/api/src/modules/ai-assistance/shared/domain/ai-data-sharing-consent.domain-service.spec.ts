import type { AiDataSharingDecision } from "@aido/api/vocabulary";

import { AiDataSharingConsent } from "#api/modules/identity/identity-settings.public";

import { canShareWithAi } from "./ai-data-sharing-consent.domain-service.js";

const NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");

function consentOf(decision: AiDataSharingDecision, version = "2026-11-04"): AiDataSharingConsent {
  return AiDataSharingConsent.reconstitute({
    userId: "user-1",
    agreedAt: decision === "AGREED" ? NOW.subtract({ hours: 1 }) : null,
    version: decision === "UNDECIDED" ? null : version,
  });
}

describe("AI 데이터 처리 동의 판정", () => {
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
      // Given
      const consent = consentOf(decision);

      // When
      const allowed = canShareWithAi({ consent, appVersion, now: NOW });

      // Then
      expect(allowed).toBe(expected);
    },
  );

  it("1.13 이상 앱은 1.13·1.14 때 받은 옛 안내 동의로도 보낸다", () => {
    // Given
    const consent = consentOf("AGREED", "2026-10-26");

    // When
    const allowed = canShareWithAi({ consent, appVersion: "1.15.0", now: NOW });

    // Then
    expect(allowed).toBe(true);
  });

  it("지원 목록에 없는 버전에 동의했으면 1.13 이상 앱은 다시 답할 때까지 보내지 않는다", () => {
    // Given
    const consent = consentOf("AGREED", "2025-01-01");

    // When
    const allowed = canShareWithAi({ consent, appVersion: "1.15.0", now: NOW });

    // Then
    expect(allowed).toBe(false);
  });
});
