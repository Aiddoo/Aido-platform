import { QuotaWindow } from "./quota-window.vo.js";

describe("QuotaWindow", () => {
  it.each([
    { at: "2026-04-30T14:59:59.999Z", period: "2026-M04", next: "2026-04-30T15:00:00.000Z" },
    { at: "2026-04-30T15:00:00.000Z", period: "2026-M05", next: "2026-05-31T15:00:00.000Z" },
    { at: "2026-02-28T15:00:00.000Z", period: "2026-M03", next: "2026-03-31T15:00:00.000Z" },
    { at: "2028-02-29T15:00:00.000Z", period: "2028-M03", next: "2028-03-31T15:00:00.000Z" },
    { at: "2026-12-31T15:00:00.000Z", period: "2027-M01", next: "2027-01-31T15:00:00.000Z" },
  ])("KST $at 의 기간은 $period 이고 다음 리셋은 $next 이다", ({ at, period, next }) => {
    // Given
    const reference = new Date(at);

    // When
    const window = QuotaWindow.monthAt(reference);

    // Then
    expect(window.periodKey).toBe(period);
    expect(window.resetsAt.toISOString()).toBe(next);
    expect(window.resetsAt.getTime()).toBeGreaterThan(reference.getTime());
    expect(reference.toISOString()).toBe(at);
  });

  it("UTC 날짜가 같아도 KST 월 경계 전후는 다른 기간이다", () => {
    // Given
    const before = new Date("2026-04-30T14:59:59Z");
    const window = QuotaWindow.monthAt(new Date("2026-04-30T15:00:00Z"));

    // When
    const contained = window.contains(before);

    // Then
    expect(contained).toBe(false);
    expect(window.contains(null)).toBe(false);
    expect(window.contains(new Date("2026-05-31T14:59:59Z"))).toBe(true);
  });

  it("반환한 resetsAt을 바꿔도 기간은 바뀌지 않는다", () => {
    // Given
    const window = QuotaWindow.monthAt(new Date("2026-04-12T12:00:00Z"));

    // When
    window.resetsAt.setUTCFullYear(2000);

    // Then
    expect(window.resetsAt.toISOString()).toBe("2026-04-30T15:00:00.000Z");
  });
});
