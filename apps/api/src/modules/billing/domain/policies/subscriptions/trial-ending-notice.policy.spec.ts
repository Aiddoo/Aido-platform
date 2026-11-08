import { TrialEndingNoticePolicy } from "./trial-ending-notice.policy.js";

describe("TrialEndingNoticePolicy", () => {
  it("안내 시작 시각은 지금부터 3일 뒤까지다", () => {
    // Given
    const now = new Date("2028-02-27T03:00:00.000Z");

    // When
    const until = TrialEndingNoticePolicy.noticeUntil(now);

    // Then
    expect(until).toEqual(new Date("2028-03-01T03:00:00.000Z"));
  });

  it.each([
    // 1개월 체험은 스토어가 정한 끝(1/31 → 2/29)으로 판단한다
    { startedAt: "2028-01-31T00:00:00Z", expiresAt: "2028-02-29T00:00:00Z", expected: true },
    { startedAt: "2026-11-01T00:00:00Z", expiresAt: "2026-11-04T00:00:00.001Z", expected: true },
    { startedAt: "2026-11-01T00:00:00Z", expiresAt: "2026-11-04T00:00:00Z", expected: false },
    { startedAt: "2026-11-01T00:00:00Z", expiresAt: "2026-11-02T00:00:00Z", expected: false },
  ])(
    "$startedAt에 시작해 $expiresAt에 끝나는 체험의 안내 여부는 $expected다",
    ({ startedAt, expiresAt, expected }) => {
      // Given
      const trial = { startedAt: new Date(startedAt), expiresAt: new Date(expiresAt) };

      // When
      const noticeable = TrialEndingNoticePolicy.isNoticeable(trial);

      // Then
      expect(noticeable).toBe(expected);
    },
  );
});
