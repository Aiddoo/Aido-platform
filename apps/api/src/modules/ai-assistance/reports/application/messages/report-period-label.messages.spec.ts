import { computePeriodLabel } from "./report-period-label.messages.js";

const THIS_YEAR_TODAY = Temporal.PlainDate.from("2026-11-12");

describe("computePeriodLabel", () => {
  it.each([
    ["2026-W10은 목요일 3월 5일의 주", 2026, 10, "3월 1주차", "Week 1 of Mar"],
    ["2026-W53은 목요일 12월 31일의 주", 2026, 53, "12월 5주차", "Week 5 of Dec"],
    [
      "2026-W01은 목요일 1월 1일의 주라 2025년 12월 29일에 시작해도 1월",
      2026,
      1,
      "1월 1주차",
      "Week 1 of Jan",
    ],
    [
      "지난해 2025-W49는 연도를 붙여 올해 12월 1주차와 구별한다",
      2025,
      49,
      "2025년 12월 1주차",
      "Week 1 of Dec 2025",
    ],
  ] as const)("주간 라벨은 주간 성취와 같은 모양이다: %s", (_name, year, week, ko, en) => {
    // When
    const korean = computePeriodLabel({
      type: "WEEKLY",
      year,
      period: week,
      locale: "ko",
      localToday: THIS_YEAR_TODAY,
    });
    const english = computePeriodLabel({
      type: "WEEKLY",
      year,
      period: week,
      locale: "en",
      localToday: THIS_YEAR_TODAY,
    });

    // Then
    expect([korean, english]).toEqual([ko, en]);
  });

  it("월간 라벨은 연도와 달이다", () => {
    // When
    const korean = computePeriodLabel({
      type: "MONTHLY",
      year: 2026,
      period: 3,
      locale: "ko",
      localToday: THIS_YEAR_TODAY,
    });
    const english = computePeriodLabel({
      type: "MONTHLY",
      year: 2026,
      period: 3,
      locale: "en",
      localToday: THIS_YEAR_TODAY,
    });

    // Then
    expect([korean, english]).toEqual(["2026년 3월", "March 2026"]);
  });
});
