import { BillingNoticeWindowPolicy } from "./billing-notice-window.policy.js";

describe("BillingNoticeWindowPolicy", () => {
  it("안내 대상은 지금부터 정확히 며칠 뒤까지 끝나는 기간이다", () => {
    // Given
    const now = new Date("2028-02-27T03:00:00.000Z");

    // When
    const until = BillingNoticeWindowPolicy.noticeUntil(now, 3);

    // Then
    expect(until).toEqual(new Date("2028-03-01T03:00:00.000Z"));
  });

  it.each([
    // 1개월 체험은 스토어가 정한 끝(1/31 → 2/29)으로 판단한다
    { startedAt: "2028-01-31T00:00:00Z", endsAt: "2028-02-29T00:00:00Z", expected: true },
    { startedAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-04T00:00:00.001Z", expected: true },
    { startedAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-04T00:00:00Z", expected: false },
    { startedAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-02T00:00:00Z", expected: false },
  ])(
    "$startedAt에 시작해 $endsAt에 끝나는 기간의 3일 전 안내 여부는 $expected다",
    ({ startedAt, endsAt, expected }) => {
      // Given
      const days = 3;

      // When
      const noticeable = BillingNoticeWindowPolicy.isNoticeable(
        new Date(startedAt),
        new Date(endsAt),
        days,
      );

      // Then
      expect(noticeable).toBe(expected);
    },
  );
});
