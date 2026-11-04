import { crossedThresholds, usagePeriod } from "./usage-period.js";

describe("usagePeriod", () => {
  it("KST 자정이 지나도 UTC 날짜·달로 기간을 나눈다", () => {
    // Given
    const at = new Date("2026-11-30T16:30:00.000Z");

    // When
    const keys = [usagePeriod.day(at), usagePeriod.month(at)];

    // Then
    expect(keys).toEqual(["2026-11-30", "2026-11"]);
  });
});

describe("crossedThresholds", () => {
  it.each([
    { total: 300_000, amount: 1, expected: [300_000] },
    { total: 300_001, amount: 1, expected: [] },
    { total: 400_010, amount: 200_000, expected: [300_000, 400_000] },
    { total: 299_999, amount: 1, expected: [] },
  ])(
    "누적 $total(이번 $amount)이면 $expected 기준선을 처음 넘긴다",
    ({ total, amount, expected }) => {
      // When
      const crossed = crossedThresholds(total, amount, [300_000, 400_000]);

      // Then
      expect(crossed).toEqual(expected);
    },
  );
});
