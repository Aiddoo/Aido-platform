import { AiDataSharingConsent } from "./ai-data-sharing-consent.entity.js";

const NOW = Temporal.Instant.from("2026-11-10T00:00:00Z");
const USER_ID = "clz7x5p8k0001qz0z8z8z8z8z";

function consent(agreedAt: Temporal.Instant | null, version: string | null) {
  return AiDataSharingConsent.reconstitute({ userId: USER_ID, agreedAt, version });
}

describe("AiDataSharingConsent — AI 처리 동의 판정", () => {
  it.each([
    ["답한 적 없음", null, null, { decision: "UNDECIDED", agreedVersion: null }],
    ["거부·철회", null, "2026-11-04", { decision: "DECLINED", agreedVersion: null }],
    [
      "지원하는 옛 버전 동의",
      NOW,
      "2026-10-26",
      { decision: "AGREED", agreedVersion: "2026-10-26" },
    ],
    [
      "지원 목록에 없는 버전 동의",
      NOW,
      "2025-01-01",
      { decision: "UNDECIDED", agreedVersion: null },
    ],
  ])("%s의 상태", (_case, agreedAt, version, expected) => {
    // When
    const status = consent(agreedAt, version).status();

    // Then
    expect(status).toEqual(expected);
  });

  it("필요한 안내 버전과 같거나 나중 버전에 동의했을 때만 AI 처리를 허용한다", () => {
    // Given
    const latest = consent(NOW, "2026-11-04");
    const older = consent(NOW, "2026-10-26");

    // When
    const outcomes = [
      latest.allowsAiProcessingAt(NOW, "2026-11-04"),
      latest.allowsAiProcessingAt(NOW, "2026-10-26"),
      older.allowsAiProcessingAt(NOW, "2026-10-26"),
      older.allowsAiProcessingAt(NOW, "2026-11-04"),
    ];

    // Then
    expect(outcomes).toEqual([true, true, true, false]);
  });

  it("거부·미응답이거나 동의 시각이 판정 시각보다 뒤면 허용하지 않는다", () => {
    // When
    const outcomes = [
      consent(null, "2026-11-04").allowsAiProcessingAt(NOW, "2026-10-26"),
      AiDataSharingConsent.undecided(USER_ID).allowsAiProcessingAt(NOW, "2026-10-26"),
      consent(NOW.add({ seconds: 1 }), "2026-11-04").allowsAiProcessingAt(NOW, "2026-10-26"),
    ];

    // Then
    expect(outcomes).toEqual([false, false, false]);
  });
});
