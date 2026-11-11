import {
  marketingAgreedSince,
  marketingReconfirmCutoff,
} from "./marketing-consent.domain-service.js";

describe("광고성 수신 동의 2년 재확인", () => {
  it("기준 시각은 2년 전 같은 날이고 윤일은 그해 2월 말로 줄어든다", () => {
    // Given
    const leapDay = Temporal.Instant.from("2028-02-29T03:00:00.000Z");

    // When
    const cutoff = marketingReconfirmCutoff(leapDay);

    // Then
    expect(cutoff).toEqual(Temporal.Instant.from("2026-02-28T03:00:00.000Z"));
  });

  it("처음 동의한 시각은 이메일·앱 푸시 중 이른 쪽이고 동의가 없으면 null이다", () => {
    // Given
    const consents = [
      {
        marketingAgreedAt: Temporal.Instant.from("2025-03-01T00:00:00.000Z"),
        marketingPushAgreedAt: Temporal.Instant.from("2026-01-17T10:00:00.000Z"),
      },
      { marketingAgreedAt: null, marketingPushAgreedAt: null },
    ];

    // When
    const since = consents.map(marketingAgreedSince);

    // Then
    expect(since).toEqual([Temporal.Instant.from("2025-03-01T00:00:00.000Z"), null]);
  });
});
