import { ErrorCode } from "@aido/api/errors";

import { IsoWeek } from "./iso-week.vo.js";

function rangeOf(year: number, week: number) {
  const isoWeek = IsoWeek.create(year, week);
  return { startDate: isoWeek.startDate.toString(), endDate: isoWeek.endDate.toString() };
}

describe("IsoWeek", () => {
  it("연초 1주·DST 전환 주·53주·다음 해 1주의 월~일 날짜를 시간대와 상관없이 준다", () => {
    // Given
    const weeks = [
      [2026, 1],
      [2026, 10],
      [2026, 44],
      [2026, 53],
      [2027, 1],
      [2028, 9],
    ] as const;

    // When
    const ranges = weeks.map(([year, week]) => rangeOf(year, week));

    // Then
    expect(ranges).toEqual([
      { startDate: "2025-12-29", endDate: "2026-01-04" },
      // 미국 DST 시작(3/8)·종료(11/1) 주. LA 시간대로 실행해도 날짜가 하루 밀리지 않는다
      { startDate: "2026-03-02", endDate: "2026-03-08" },
      { startDate: "2026-10-26", endDate: "2026-11-01" },
      { startDate: "2026-12-28", endDate: "2027-01-03" },
      { startDate: "2027-01-04", endDate: "2027-01-10" },
      // 윤년 2월 29일을 품은 주
      { startDate: "2028-02-28", endDate: "2028-03-05" },
    ]);
  });

  it.each([
    { previous: [2026, 9], next: [2026, 10], expected: true },
    { previous: [2026, 9], next: [2026, 11], expected: false },
    { previous: [2025, 52], next: [2026, 1], expected: true },
    { previous: [2026, 52], next: [2027, 1], expected: false },
    { previous: [2026, 53], next: [2027, 1], expected: true },
    { previous: [2020, 53], next: [2021, 1], expected: true },
    { previous: [2026, 10], next: [2027, 11], expected: false },
  ] as const)("$previous 다음 주가 $next인지는 $expected", ({ previous, next, expected }) => {
    // Given
    const before = IsoWeek.create(previous[0], previous[1]);
    const after = IsoWeek.create(next[0], next[1]);

    // When
    const followed = before.isFollowedBy(after);

    // Then
    expect(followed).toBe(expected);
  });

  it.each([0, 54, 1.5])("주가 1~53 정수가 아니면(%s) SYS_0002로 거절한다", (week) => {
    // When
    const creating = () => IsoWeek.create(2026, week);

    // Then
    expect(creating).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
  });
});
