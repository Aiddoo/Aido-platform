import { plainDateFromDate, plainDateToDate } from "./plain-date.js";

describe("UTC 자정 Date와 달력 날짜 변환", () => {
  it.each(["2026-03-08", "2026-11-01", "2028-02-29", "2026-12-31"])(
    "%s를 UTC 자정 Date로 바꿨다 되돌리면 같은 날짜다",
    (key) => {
      // Given
      const date = Temporal.PlainDate.from(key);

      // When
      const utcMidnight = plainDateToDate(date);

      // Then
      expect(utcMidnight.toISOString()).toBe(`${key}T00:00:00.000Z`);
      expect(plainDateFromDate(utcMidnight).equals(date)).toBe(true);
    },
  );
});
