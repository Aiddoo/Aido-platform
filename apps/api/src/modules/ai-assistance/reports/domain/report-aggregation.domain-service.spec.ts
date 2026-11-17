import {
  computeCategoryBreakdown,
  computeDailyCompletions,
  computeDayPatterns,
  computeStreakDays,
  computeTimePatterns,
  FALLBACK_CATEGORY_COLOR,
} from "./report-aggregation.domain-service.js";

// 사용자 현지 자정의 순간
const localMidnight = (date: string, timezone: string) =>
  new Date(Temporal.PlainDate.from(date).toZonedDateTime(timezone).epochMilliseconds);

const row = (date: string, count: number) => ({
  startDate: new Date(`${date}T00:00:00.000Z`),
  _count: { id: count },
});

describe("보고서 DATE label과 실제 시각", () => {
  it("저장된 월요일 DATE는 실행 타임존과 무관하게 월요일이다", () => {
    // When
    const patterns = computeDayPatterns([row("2026-03-16", 2)], [row("2026-03-16", 1)]);

    // Then
    expect(patterns.find((pattern) => pattern.day === "MON")).toEqual({
      day: "MON",
      total: 2,
      completed: 1,
      rate: 50,
    });
    expect(patterns.find((pattern) => pattern.day === "SUN")?.total).toBe(0);
  });
  it.each(["Asia/Seoul", "America/Los_Angeles", "America/New_York"])(
    "%s의 실제 기간 경계와 DATE label을 결합해 월~일 streak을 계산한다",
    (timezone) => {
      // Given
      const groups = [row("2026-03-09", 1), row("2026-03-15", 1)];

      // When
      const streakDays = computeStreakDays(
        groups,
        groups,
        localMidnight("2026-03-09", timezone),
        localMidnight("2026-03-16", timezone),
        timezone,
      );

      // Then
      expect(streakDays).toBe(2);
    },
  );
  it("LA 마지막 일요일 미완료 기록은 월요일 경계 전에 streak을 끊는다", () => {
    // When
    const streakDays = computeStreakDays(
      [row("2026-03-09", 1), row("2026-03-15", 2)],
      [row("2026-03-09", 1), row("2026-03-15", 1)],
      localMidnight("2026-03-09", "America/Los_Angeles"),
      localMidnight("2026-03-16", "America/Los_Angeles"),
      "America/Los_Angeles",
    );

    // Then
    expect(streakDays).toBe(0);
  });
  it("완료 시각은 DATE label과 달리 실제 instant를 사용자 타임존으로 변환한다", () => {
    // Given
    const todos = [
      {
        startDate: new Date("2026-03-16T00:00:00.000Z"),
        completedAt: new Date("2026-03-16T17:00:00.000Z"),
      },
      { startDate: new Date("2026-03-16T00:00:00.000Z"), completedAt: null },
    ];

    // When
    const timePatterns = computeTimePatterns(todos, "America/Los_Angeles");

    // Then
    expect(timePatterns).toEqual([{ hour: 10, count: 1 }]);
  });
});

describe("카테고리별 집계", () => {
  it("완료 수를 카테고리에 붙이고 전체 수 내림차순, 동률은 입력 순서로 정렬한다", () => {
    // Given
    const totalGroups = [
      { categoryId: 1, _count: { id: 2 } },
      { categoryId: 2, _count: { id: 4 } },
      { categoryId: 3, _count: { id: 2 } },
    ];
    const completedGroups = [{ categoryId: 2, _count: { id: 1 } }];
    const categories = [
      { id: 1, name: "업무", color: "#111111" },
      { id: 2, name: "운동", color: "#222222" },
    ];

    // When
    const breakdown = computeCategoryBreakdown(totalGroups, completedGroups, categories, "기타");

    // Then
    expect(breakdown).toEqual([
      { name: "운동", color: "#222222", total: 4, completed: 1, rate: 25 },
      { name: "업무", color: "#111111", total: 2, completed: 0, rate: 0 },
      { name: "기타", color: "#808080", total: 2, completed: 0, rate: 0 },
    ]);
  });

  it.each([
    { language: "ko", fallbackName: "기타" },
    { language: "en", fallbackName: "Other" },
  ])("지운 카테고리는 넘긴 $language 라벨과 회색으로 집계한다", ({ fallbackName }) => {
    // Given
    const totalGroups = [{ categoryId: 9, _count: { id: 2 } }];

    // When
    const breakdown = computeCategoryBreakdown(totalGroups, [], [], fallbackName);

    // Then
    expect(breakdown).toEqual([
      { name: fallbackName, color: FALLBACK_CATEGORY_COLOR, total: 2, completed: 0, rate: 0 },
    ]);
  });
});

describe("computeDailyCompletions", () => {
  it.each([
    ["주간", "2026-11-09", "2026-11-15", 7],
    ["윤년 2월 월간", "2028-02-01", "2028-02-29", 29],
    ["평년 2월 월간", "2027-02-01", "2027-02-28", 28],
    ["31일 달 월간", "2026-10-01", "2026-10-31", 31],
    ["해를 넘기는 ISO 주", "2026-12-28", "2027-01-03", 7],
    ["미국 DST가 끝나는 주", "2026-10-26", "2026-11-01", 7],
  ])("%s는 첫날부터 마지막 날까지 하루씩 채운다", (_title, first, last, dayCount) => {
    // When
    const result = computeDailyCompletions({
      totalGroups: [],
      completedGroups: [],
      period: { firstDay: Temporal.PlainDate.from(first), lastDay: Temporal.PlainDate.from(last) },
    });

    // Then
    expect(result).toHaveLength(dayCount);
    expect(result[0]?.date.toString()).toBe(first);
    expect(result.at(-1)?.date.toString()).toBe(last);
  });

  it("기록 없는 날은 0이고 합이 전체 할 일 수와 같다", () => {
    // Given
    const totalGroups = [row("2026-12-29", 3), row("2027-01-02", 2)];
    const completedGroups = [row("2026-12-29", 1)];

    // When
    const result = computeDailyCompletions({
      totalGroups,
      completedGroups,
      period: {
        firstDay: Temporal.PlainDate.from("2026-12-28"),
        lastDay: Temporal.PlainDate.from("2027-01-03"),
      },
    });

    // Then
    expect(result.map(({ date, total, completed }) => [date.toString(), total, completed])).toEqual(
      [
        ["2026-12-28", 0, 0],
        ["2026-12-29", 3, 1],
        ["2026-12-30", 0, 0],
        ["2026-12-31", 0, 0],
        ["2027-01-01", 0, 0],
        ["2027-01-02", 2, 0],
        ["2027-01-03", 0, 0],
      ],
    );
    expect(result.reduce((sum, item) => sum + item.total, 0)).toBe(5);
  });
});
