import { billingNoticeUntil, isBillingNoticeable } from "./billing-notice-window.domain-service.js";

describe("BillingNoticeWindowDomainService", () => {
  it("안내 대상은 지금부터 정확히 며칠 뒤까지 끝나는 기간이다", () => {
    // Given
    const now = Temporal.Instant.from("2028-02-27T03:00:00.000Z");

    // When
    const until = billingNoticeUntil(now, 3);

    // Then
    expect(until).toEqual(Temporal.Instant.from("2028-03-01T03:00:00.000Z"));
  });

  it.each([
    // 2주 체험은 스토어가 정한 끝(2/15 → 2/29)으로 판단한다
    { startedAt: "2028-02-15T00:00:00Z", endsAt: "2028-02-29T00:00:00Z", expected: true },
    { startedAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-04T00:00:00.001Z", expected: true },
    { startedAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-04T00:00:00Z", expected: false },
    { startedAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-02T00:00:00Z", expected: false },
  ])(
    "$startedAt에 시작해 $endsAt에 끝나는 기간의 3일 전 안내 여부는 $expected다",
    ({ startedAt, endsAt, expected }) => {
      // Given
      const days = 3;

      // When
      const noticeable = isBillingNoticeable(
        Temporal.Instant.from(startedAt),
        Temporal.Instant.from(endsAt),
        days,
      );

      // Then
      expect(noticeable).toBe(expected);
    },
  );
});
