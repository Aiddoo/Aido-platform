import {
  planRepeatRefFixture,
  scheduleDraftFixture,
  type ScheduleDraftInput,
} from "#test/fixtures/ai-response.fixture";

import type { ScheduleDraft } from "./todo-draft.constants.js";
import { resolvePlanSchedule, resolveTodoSchedule } from "./todo-schedule.domain-service.js";

// 같은 순간을 두 시간대로 해석한다: 서울 2026-10-28(수) 10:00, LA 2026-10-27(화) 18:00
const NOW = new Date("2026-10-28T01:00:00Z");
const SEOUL = { now: NOW, timeZone: "Asia/Seoul" };
const LOS_ANGELES = { now: NOW, timeZone: "America/Los_Angeles" };

const none = { pattern: "NONE" } as const;
const draft = (overrides: ScheduleDraftInput = {}): ScheduleDraft =>
  scheduleDraftFixture({ repeat: none, ...overrides });

describe("resolveTodoSchedule — ko golden (서울 수 10:00)", () => {
  it("격주 화요일을 UNSUPPORTED로 받아도 말한 요일이 date에 있어야 다음 화요일이고, NONE이면 오늘로 어긋난다(ko-16)", () => {
    // Given
    const repeat = { pattern: "UNSUPPORTED" } as const;
    const withWeekday = draft({ date: { kind: "WEEKDAY", weekday: "TUE" }, repeat });
    const withoutDate = draft({ repeat });
    // When
    const results = [withWeekday, withoutDate].map((input) => resolveTodoSchedule(input, SEOUL));
    // Then
    expect(results.map(({ startDate }) => startDate)).toEqual(["2026-11-03", "2026-10-28"]);
  });

  it.each([
    {
      id: "ko-01 내일 오후 3시 팀 미팅",
      input: draft({
        date: { kind: "OFFSET_DAYS", amount: 1 },
        time: { hour: 3, minute: 0, meridiem: "PM" },
      }),
      expected: { startDate: "2026-10-29", scheduledTime: "15:00", isAllDay: false },
    },
    {
      id: "ko-02 다음 주 금요일 보고서 제출",
      input: draft({ date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 1 } }),
      expected: { startDate: "2026-11-06", scheduledTime: null, isAllDay: true },
    },
    {
      id: "ko-03 금요일까지 기획안 초안",
      input: draft({ endDate: { kind: "WEEKDAY", weekday: "FRI" } }),
      expected: { startDate: "2026-10-28", endDate: "2026-10-30" },
    },
    {
      id: "ko-04 3시 치과 (03:00 지남 → 15:00)",
      input: draft({ time: { hour: 3, minute: 0, meridiem: "NONE" } }),
      expected: { startDate: "2026-10-28", scheduledTime: "15:00" },
    },
    {
      id: "ko-05 9시 헬스",
      input: draft({ time: { hour: 9, minute: 0, meridiem: "NONE" } }),
      expected: { startDate: "2026-10-28", scheduledTime: "21:00" },
    },
    {
      id: "ko-06 매주 월수금 아침 7시 러닝",
      input: draft({
        time: { hour: 7, minute: 0, meridiem: "AM" },
        repeat: { pattern: "WEEKLY_DAYS", daysOfWeek: ["FRI", "MON", "WED"] },
      }),
      expected: {
        startDate: "2026-10-28",
        scheduledTime: "07:00",
        isRecurring: true,
        recurrence: { daysOfWeek: ["MON", "WED", "FRI"], endDate: "2026-11-25" },
      },
    },
    {
      id: "ko-07 이번 주 운동",
      input: draft({ repeat: { pattern: "THIS_WEEK" } }),
      expected: {
        startDate: "2026-10-28",
        recurrence: { daysOfWeek: ["WED", "THU", "FRI", "SAT", "SUN"], endDate: "2026-11-01" },
      },
    },
    {
      id: "ko-08 다음 주말 영화",
      input: draft({ repeat: { pattern: "NEXT_WEEKEND" } }),
      expected: {
        startDate: "2026-11-07",
        recurrence: { daysOfWeek: ["SAT", "SUN"], endDate: "2026-11-08" },
      },
    },
    {
      id: "ko-09 11월 3일 엄마 생신",
      input: draft({ date: { kind: "CALENDAR_DATE", month: 11, day: 3 } }),
      expected: { startDate: "2026-11-03" },
    },
    {
      id: "ko-10 3월 2일 개강 (지남 → 내년)",
      input: draft({ date: { kind: "CALENDAR_DATE", month: 3, day: 2 } }),
      expected: { startDate: "2027-03-02" },
    },
    {
      id: "ko-11 이번 달 말 월세 납부",
      input: draft({ date: { kind: "MONTH_END", amount: 0 } }),
      expected: { startDate: "2026-10-31" },
    },
    {
      id: "ko-12 2시간 후 빨래 걷기",
      input: draft({ time: { relativeMinutes: 120 } }),
      expected: { startDate: "2026-10-28", scheduledTime: "12:00" },
    },
    {
      id: "ko-13 자정에 약 먹기",
      input: draft({ time: { partOfDay: "MIDNIGHT" } }),
      expected: { startDate: "2026-10-29", scheduledTime: "00:00" },
    },
    {
      id: "ko-14 오전 8시 산책 (지남 → 내일)",
      input: draft({ time: { hour: 8, minute: 0, meridiem: "AM" } }),
      expected: { startDate: "2026-10-29", scheduledTime: "08:00" },
    },
    {
      id: "ko-16 격주 화요일 스터디",
      input: draft({
        date: { kind: "WEEKDAY", weekday: "TUE" },
        repeat: { pattern: "UNSUPPORTED" },
      }),
      expected: {
        startDate: "2026-11-03",
        isRecurring: false,
        recurrence: null,
        warnings: ["UNSUPPORTED_RECURRENCE"],
      },
    },
  ])("$id", ({ input, expected }) => {
    // Given / When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject(expected);
  });
});

describe("resolveTodoSchedule — en golden (LA 화 18:00)", () => {
  it.each([
    {
      id: "en-01 Dentist tomorrow at 3pm",
      input: draft({
        date: { kind: "OFFSET_DAYS", amount: 1 },
        time: { hour: 3, minute: 0, meridiem: "PM" },
      }),
      expected: { startDate: "2026-10-28", scheduledTime: "15:00" },
    },
    {
      id: "en-02 Submit report next Friday (다음 ISO 주 금요일)",
      input: draft({ date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 1 } }),
      expected: { startDate: "2026-11-06" },
    },
    {
      id: "en-03 Call mom at 8",
      input: draft({ time: { hour: 8, minute: 0, meridiem: "NONE" } }),
      expected: { startDate: "2026-10-27", scheduledTime: "20:00" },
    },
    {
      id: "en-04 Gym every Mon Wed Fri at 7am",
      input: draft({
        time: { hour: 7, minute: 0, meridiem: "AM" },
        repeat: { pattern: "WEEKLY_DAYS", daysOfWeek: ["MON", "WED", "FRI"] },
      }),
      expected: {
        startDate: "2026-10-27",
        scheduledTime: "07:00",
        recurrence: { daysOfWeek: ["MON", "WED", "FRI"], endDate: "2026-11-24" },
      },
    },
    {
      id: "en-05 Pay rent by the end of the month",
      input: draft({ endDate: { kind: "MONTH_END", amount: 0 } }),
      expected: { startDate: "2026-10-27", endDate: "2026-10-31" },
    },
    {
      id: "en-06 Workout this week",
      input: draft({ repeat: { pattern: "THIS_WEEK" } }),
      expected: {
        startDate: "2026-10-27",
        recurrence: {
          daysOfWeek: ["TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          endDate: "2026-11-01",
        },
      },
    },
    {
      id: "en-07 Movie next weekend",
      input: draft({ repeat: { pattern: "NEXT_WEEKEND" } }),
      expected: {
        startDate: "2026-11-07",
        recurrence: { daysOfWeek: ["SAT", "SUN"], endDate: "2026-11-08" },
      },
    },
    {
      id: "en-08 Dinner with Alex in 3 days",
      input: draft({ date: { kind: "OFFSET_DAYS", amount: 3 } }),
      expected: { startDate: "2026-10-30" },
    },
    {
      id: "en-09 Water plants tonight",
      input: draft({ time: { partOfDay: "NIGHT" } }),
      expected: { startDate: "2026-10-27", scheduledTime: "21:00" },
    },
  ])("$id", ({ input, expected }) => {
    // Given / When
    const result = resolveTodoSchedule(input, LOS_ANGELES);
    // Then
    expect(result).toMatchObject(expected);
  });

  it("교차 시간대: 같은 내일 draft가 서울·LA·UTC에서 각자의 내일이 된다", () => {
    // Given
    const tomorrow = draft({ date: { kind: "OFFSET_DAYS", amount: 1 } });
    // When / Then
    expect(resolveTodoSchedule(tomorrow, SEOUL).startDate).toBe("2026-10-29");
    expect(resolveTodoSchedule(tomorrow, LOS_ANGELES).startDate).toBe("2026-10-28");
    expect(resolveTodoSchedule(tomorrow, { now: NOW, timeZone: "UTC" }).startDate).toBe(
      "2026-10-29",
    );
  });
});

describe("resolveTodoSchedule — 결정 규칙과 경계", () => {
  it("오늘과 같은 요일만 말하면 오늘이다", () => {
    // Given - 서울 수요일에 "수요일"
    const input = draft({ date: { kind: "WEEKDAY", weekday: "WED" } });
    // When / Then
    expect(resolveTodoSchedule(input, SEOUL).startDate).toBe("2026-10-28");
  });

  it("날짜를 말한 오전/오후 없는 시각은 1~6시 오후, 7~11시 오전이다", () => {
    // Given
    const at = (hour: number) =>
      draft({ date: { kind: "OFFSET_DAYS", amount: 1 }, time: { hour, meridiem: "NONE" } });
    // When / Then
    expect(resolveTodoSchedule(at(3), SEOUL).scheduledTime).toBe("15:00");
    expect(resolveTodoSchedule(at(6), SEOUL).scheduledTime).toBe("18:00");
    expect(resolveTodoSchedule(at(7), SEOUL).scheduledTime).toBe("07:00");
    expect(resolveTodoSchedule(at(12), SEOUL).scheduledTime).toBe("12:00");
  });

  it("때만 말하면 기본 시각을 넣는다 (아침 09·점심 12·오후 15·저녁 19·밤 21)", () => {
    // Given - 내일 기준으로 지난 시각 보정을 배제한다
    const at = (partOfDay: "MORNING" | "NOON" | "AFTERNOON" | "EVENING" | "NIGHT") =>
      draft({ date: { kind: "OFFSET_DAYS", amount: 1 }, time: { partOfDay } });
    // When / Then
    expect(resolveTodoSchedule(at("MORNING"), SEOUL).scheduledTime).toBe("09:00");
    expect(resolveTodoSchedule(at("NOON"), SEOUL).scheduledTime).toBe("12:00");
    expect(resolveTodoSchedule(at("AFTERNOON"), SEOUL).scheduledTime).toBe("15:00");
    expect(resolveTodoSchedule(at("EVENING"), SEOUL).scheduledTime).toBe("19:00");
    expect(resolveTodoSchedule(at("NIGHT"), SEOUL).scheduledTime).toBe("21:00");
  });

  it("오전/오후 없는 시각이 오늘 둘 다 지났으면 내일의 일반적 시각이다", () => {
    // Given - 서울 23:30
    const lateNight = { now: new Date("2026-10-28T14:30:00Z"), timeZone: "Asia/Seoul" };
    // When
    const result = resolveTodoSchedule(draft({ time: { hour: 9, meridiem: "NONE" } }), lateNight);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-29", scheduledTime: "09:00" });
  });

  it("자정 직전의 상대 시각은 날짜를 넘긴다", () => {
    // Given - 서울 23:30에 "1시간 후"
    const lateNight = { now: new Date("2026-10-28T14:30:00Z"), timeZone: "Asia/Seoul" };
    // When
    const result = resolveTodoSchedule(draft({ time: { relativeMinutes: 60 } }), lateNight);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-29", scheduledTime: "00:30" });
  });

  it("LA 서머타임 종료일에도 달력 날짜로 내일을 계산한다", () => {
    // Given - 2026-11-01 01:30 PST 이후(두 번째 01:30)
    const dstEnd = { now: new Date("2026-11-01T09:30:00Z"), timeZone: "America/Los_Angeles" };
    // When
    const result = resolveTodoSchedule(draft({ date: { kind: "OFFSET_DAYS", amount: 1 } }), dstEnd);
    // Then
    expect(result.startDate).toBe("2026-11-02");
  });

  it("윤일 2028-02-29를 그대로 해석하고 다음 날은 3월 1일이다", () => {
    // Given - 서울 2028-02-28 12:00
    const leap = { now: new Date("2028-02-28T03:00:00Z"), timeZone: "Asia/Seoul" };
    // When
    const leapDay = resolveTodoSchedule(
      draft({ date: { kind: "CALENDAR_DATE", month: 2, day: 29 } }),
      leap,
    );
    const dayAfter = resolveTodoSchedule(draft({ date: { kind: "OFFSET_DAYS", amount: 2 } }), leap);
    // Then
    expect(leapDay.startDate).toBe("2028-02-29");
    expect(dayAfter.startDate).toBe("2028-03-01");
  });

  it("없는 날짜는 오늘로 두고 INVALID_DATE를 남긴다", () => {
    // Given
    const input = draft({ date: { kind: "CALENDAR_DATE", year: 2_026, month: 2, day: 30 } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-28", warnings: ["INVALID_DATE"] });
  });

  it("말일 다음 달 오프셋은 그 달 말일로 맞추고, 월만 생략한 31일은 다음 31일이다", () => {
    // Given - 서울 2027-01-31
    const monthEnd = { now: new Date("2027-01-31T03:00:00Z"), timeZone: "Asia/Seoul" };
    // When
    const nextMonth = resolveTodoSchedule(
      draft({ date: { kind: "OFFSET_MONTHS", amount: 1 } }),
      monthEnd,
    );
    const day30 = resolveTodoSchedule(
      draft({ date: { kind: "CALENDAR_DATE", day: 30 } }),
      monthEnd,
    );
    // Then
    expect(nextMonth.startDate).toBe("2027-02-28");
    expect(day30.startDate).toBe("2027-03-30");
  });

  it("연말에 다음 달 초와 내년 초를 새해로 계산한다", () => {
    // Given - 서울 2026-12-31
    const yearEnd = { now: new Date("2026-12-31T03:00:00Z"), timeZone: "Asia/Seoul" };
    // When / Then
    expect(
      resolveTodoSchedule(draft({ date: { kind: "MONTH_START", amount: 1 } }), yearEnd).startDate,
    ).toBe("2027-01-01");
    expect(
      resolveTodoSchedule(draft({ date: { kind: "YEAR_START", amount: 1 } }), yearEnd).startDate,
    ).toBe("2027-01-01");
    expect(
      resolveTodoSchedule(
        draft({ date: { kind: "WEEKDAY", weekday: "MON", weekOffset: 1 } }),
        yearEnd,
      ).startDate,
    ).toBe("2027-01-04");
  });

  it("종료일이 시작일보다 앞이면 종료일을 버리고 경고를 남긴다", () => {
    // Given
    const input = draft({
      date: { kind: "OFFSET_DAYS", amount: 5 },
      endDate: { kind: "OFFSET_DAYS", amount: 1 },
    });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ endDate: null, warnings: ["END_BEFORE_START"] });
  });

  it("반복 기간과 반복 종료를 말하면 그 기간으로 끝낸다", () => {
    // Given - 한 달 동안 매일
    const input = draft({
      repeat: { pattern: "DAILY", forDuration: { unit: "MONTH", amount: 1 } },
    });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result.recurrence?.endDate).toBe("2026-11-27");
  });

  it("요일이 빈 주간 반복은 비반복으로 처리한다", () => {
    // Given
    const input = draft({ repeat: { pattern: "WEEKLY_DAYS", daysOfWeek: [] } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ isRecurring: false, warnings: ["EMPTY_RECURRENCE"] });
  });

  it("범위를 벗어난 시각은 종일로 두고 INVALID_TIME을 남긴다", () => {
    // Given
    const input = draft({ time: { hour: 25, minute: 0 } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({
      isAllDay: true,
      scheduledTime: null,
      warnings: ["INVALID_TIME"],
    });
  });
});

describe("resolveTodoSchedule — 지난 날짜를 만들지 않는다", () => {
  // 서울 2026-11-07(토) 10:00, 2026-11-08(일) 10:00
  const SATURDAY = { now: new Date("2026-11-07T01:00:00Z"), timeZone: "Asia/Seoul" };
  const SUNDAY = { now: new Date("2026-11-08T01:00:00Z"), timeZone: "Asia/Seoul" };

  it.each([
    { name: "토요일의 금요일", clock: SATURDAY, weekday: "FRI", expected: "2026-11-13" },
    { name: "토요일의 월요일", clock: SATURDAY, weekday: "MON", expected: "2026-11-09" },
    { name: "토요일의 토요일(오늘)", clock: SATURDAY, weekday: "SAT", expected: "2026-11-07" },
    {
      name: "토요일의 일요일(이번 주 남은 날)",
      clock: SATURDAY,
      weekday: "SUN",
      expected: "2026-11-08",
    },
    { name: "일요일의 금요일", clock: SUNDAY, weekday: "FRI", expected: "2026-11-13" },
    { name: "일요일의 토요일", clock: SUNDAY, weekday: "SAT", expected: "2026-11-14" },
    { name: "일요일의 일요일(오늘)", clock: SUNDAY, weekday: "SUN", expected: "2026-11-08" },
  ] as const)("이번 주 $name 은 $expected 이다", ({ clock, weekday, expected }) => {
    // Given
    const said = [0, null].map((weekOffset) =>
      draft({ date: { kind: "WEEKDAY", weekday, weekOffset } }),
    );
    // When
    const dates = said.map((input) => resolveTodoSchedule(input, clock).startDate);
    // Then
    expect(dates).toEqual([expected, expected]);
  });

  // 일요일은 ISO 주의 끝이고 11-01은 달의 첫날이라 그 주 월요일이 전달로 넘어간다.
  it.each([
    { weekday: "MON", upcoming: "2026-11-02", nextWeek: "2026-11-02" },
    { weekday: "TUE", upcoming: "2026-11-03", nextWeek: "2026-11-03" },
    { weekday: "WED", upcoming: "2026-11-04", nextWeek: "2026-11-04" },
    { weekday: "THU", upcoming: "2026-11-05", nextWeek: "2026-11-05" },
    { weekday: "FRI", upcoming: "2026-11-06", nextWeek: "2026-11-06" },
    { weekday: "SAT", upcoming: "2026-11-07", nextWeek: "2026-11-07" },
    { weekday: "SUN", upcoming: "2026-11-01", nextWeek: "2026-11-08" },
  ] as const)(
    "달의 첫날인 일요일에 $weekday 는 $upcoming, 다음 주 $weekday 는 $nextWeek 이다",
    ({ weekday, upcoming, nextWeek }) => {
      // Given
      const firstSunday = { now: new Date("2026-11-01T01:00:00Z"), timeZone: "Asia/Seoul" };
      const said = [null, 0, 1].map((weekOffset) =>
        draft({ date: { kind: "WEEKDAY", weekday, weekOffset } }),
      );
      // When
      const dates = said.map((input) => resolveTodoSchedule(input, firstSunday).startDate);
      // Then
      expect(dates).toEqual([upcoming, upcoming, nextWeek]);
    },
  );

  const PAST_DATES = [
    { name: "지난달 초", date: { kind: "MONTH_START", amount: -1 } },
    { name: "작년 초", date: { kind: "YEAR_START", amount: -1 } },
    { name: "지난달 말", date: { kind: "MONTH_END", amount: -1 } },
    { name: "작년 말", date: { kind: "YEAR_END", amount: -1 } },
    { name: "1주 전", date: { kind: "OFFSET_WEEKS", amount: -1 } },
    { name: "1달 전", date: { kind: "OFFSET_MONTHS", amount: -1 } },
  ] as const;

  it.each(PAST_DATES)("$name 표현은 오늘로 두고 INVALID_DATE를 남긴다", ({ date }) => {
    // Given
    const input = draft({ date });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result.startDate).toBe("2026-11-07");
    expect(result.warnings).toEqual(["INVALID_DATE"]);
  });

  it.each(PAST_DATES)("끝 날짜로 온 $name 표현은 시작보다 앞서지 않는다", ({ date }) => {
    // Given
    const fromToday = draft({ endDate: date });
    const fromTomorrow = draft({ date: { kind: "OFFSET_DAYS", amount: 1 }, endDate: date });
    // When
    const results = [fromToday, fromTomorrow].map((input) => resolveTodoSchedule(input, SATURDAY));
    // Then
    expect(results).toMatchObject([
      { startDate: "2026-11-07", endDate: null },
      { startDate: "2026-11-08", endDate: null },
    ]);
    expect(results[1]?.warnings).toContain("END_BEFORE_START");
  });

  it("장애 사례: 토요일의 '금요일 치과'와 '내일'은 모두 앞으로의 날짜이고 경고가 없다", () => {
    // Given
    const dentist = draft({ date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 0 } });
    const tomorrow = draft({ date: { kind: "OFFSET_DAYS", amount: 1 } });
    // When
    const results = [dentist, tomorrow].map((input) => resolveTodoSchedule(input, SATURDAY));
    // Then
    expect(results).toMatchObject([
      { startDate: "2026-11-13", warnings: [] },
      { startDate: "2026-11-08", warnings: [] },
    ]);
  });

  it("모델이 낸 지난주 요일도 앞으로의 그 요일로 넘긴다", () => {
    // Given
    const input = draft({ date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: -1 } });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result.startDate).toBe("2026-11-13");
  });

  it.each([
    { weekOffset: 1, expected: "2026-11-13" },
    { weekOffset: 2, expected: "2026-11-20" },
  ])("주를 말한 weekOffset $weekOffset은 그대로 $expected 이다", ({ weekOffset, expected }) => {
    // Given
    const input = draft({ date: { kind: "WEEKDAY", weekday: "FRI", weekOffset } });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result.startDate).toBe(expected);
  });

  it("넘긴 요일에도 말한 시각을 그대로 쓴다", () => {
    // Given
    const input = draft({
      date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 0 },
      time: { hour: 3, minute: 0, meridiem: "PM" },
    });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result).toMatchObject({ startDate: "2026-11-13", scheduledTime: "15:00" });
  });

  it("토요일의 '이번 주 금요일까지'는 기한을 버리지 않고 다음 금요일까지다", () => {
    // Given
    const input = draft({ endDate: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 0 } });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result).toMatchObject({
      startDate: "2026-11-07",
      endDate: "2026-11-13",
      warnings: [],
    });
  });

  it.each([
    { name: "이번 주를 말한", weekOffset: 0 },
    { name: "요일만 말한", weekOffset: null },
  ])("토요일에 $name '금요일부터 일요일까지'는 시작 뒤의 일요일까지다", ({ weekOffset }) => {
    // Given
    const input = draft({
      date: { kind: "WEEKDAY", weekday: "FRI", weekOffset },
      endDate: { kind: "WEEKDAY", weekday: "SUN", weekOffset },
    });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result).toMatchObject({
      startDate: "2026-11-13",
      endDate: "2026-11-15",
      warnings: [],
    });
  });

  it("음수 OFFSET_DAYS는 오늘로 두고 INVALID_DATE를 남긴다", () => {
    // Given
    const input = draft({ date: { kind: "OFFSET_DAYS", amount: -1 } });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result).toMatchObject({ startDate: "2026-11-07", warnings: ["INVALID_DATE"] });
  });

  it("연도까지 말한 지난 날짜는 오늘로 두고 INVALID_DATE를 남긴다", () => {
    // Given
    const input = draft({ date: { kind: "CALENDAR_DATE", year: 2_026, month: 11, day: 6 } });
    // When
    const result = resolveTodoSchedule(input, SATURDAY);
    // Then
    expect(result).toMatchObject({ startDate: "2026-11-07", warnings: ["INVALID_DATE"] });
  });

  it("연도까지 말한 오늘과 앞으로의 날짜는 그대로 둔다", () => {
    // Given
    const said = [7, 8].map((day) =>
      draft({ date: { kind: "CALENDAR_DATE", year: 2_026, month: 11, day } }),
    );
    // When
    const results = said.map((input) => resolveTodoSchedule(input, SATURDAY));
    // Then
    expect(results).toMatchObject([
      { startDate: "2026-11-07", warnings: [] },
      { startDate: "2026-11-08", warnings: [] },
    ]);
  });
});

describe("resolveTodoSchedule — 이번 달 초·올해 초", () => {
  const seoulAt = (date: string) => ({
    now: new Date(`${date}T01:00:00Z`),
    timeZone: "Asia/Seoul",
  });
  const monthStart = draft({ date: { kind: "MONTH_START", amount: 0 } });
  const yearStart = draft({ date: { kind: "YEAR_START", amount: 0 } });

  it.each([
    { name: "1일", today: "2026-11-01", expected: "2026-11-01" },
    { name: "초순 마지막 10일", today: "2026-11-10", expected: "2026-11-10" },
    { name: "초순이 지난 11일", today: "2026-11-11", expected: "2026-12-01" },
    { name: "말일", today: "2026-11-30", expected: "2026-12-01" },
    { name: "1월 31일", today: "2027-01-31", expected: "2027-02-01" },
    { name: "12월 10일", today: "2026-12-10", expected: "2026-12-10" },
    { name: "12월 11일", today: "2026-12-11", expected: "2027-01-01" },
    { name: "12월 31일", today: "2026-12-31", expected: "2027-01-01" },
  ])("$name 에 말한 이번 달 초는 $expected 이다", ({ today, expected }) => {
    // Given
    const clock = seoulAt(today);
    // When
    const result = resolveTodoSchedule(monthStart, clock);
    // Then
    expect(result).toMatchObject({ startDate: expected, warnings: [] });
  });

  it.each([
    { name: "1월 1일", today: "2027-01-01", expected: "2027-01-01" },
    { name: "1월 31일", today: "2027-01-31", expected: "2027-01-31" },
    { name: "2월 1일", today: "2027-02-01", expected: "2028-01-01" },
    { name: "12월 31일", today: "2026-12-31", expected: "2027-01-01" },
  ])("$name 에 말한 올해 초는 $expected 이다", ({ today, expected }) => {
    // Given
    const clock = seoulAt(today);
    // When
    const result = resolveTodoSchedule(yearStart, clock);
    // Then
    expect(result).toMatchObject({ startDate: expected, warnings: [] });
  });

  it.each([
    {
      name: "이번 달 초(서울 11일·LA 10일)",
      input: monthStart,
      now: "2026-11-10T15:30:00Z",
      seoul: "2026-12-01",
      la: "2026-11-10",
    },
    {
      name: "12월의 이번 달 초(서울 11일·LA 10일)",
      input: monthStart,
      now: "2026-12-10T15:30:00Z",
      seoul: "2027-01-01",
      la: "2026-12-10",
    },
    {
      name: "올해 초(서울 2월 1일·LA 1월 31일)",
      input: yearStart,
      now: "2027-01-31T16:00:00Z",
      seoul: "2028-01-01",
      la: "2027-01-31",
    },
  ])("같은 순간의 $name 는 사용자 시간대로 판단한다", ({ input, now, seoul, la }) => {
    // Given
    const zones = ["Asia/Seoul", "America/Los_Angeles"];
    // When
    const dates = zones.map(
      (timeZone) => resolveTodoSchedule(input, { now: new Date(now), timeZone }).startDate,
    );
    // Then
    expect(dates).toEqual([seoul, la]);
  });

  it("끝 날짜로 온 이번 달 초도 같은 규칙이라 시작보다 앞서지 않는다", () => {
    // Given
    const input = draft({ endDate: { kind: "MONTH_START", amount: 0 } });
    const clocks = [seoulAt("2026-11-07"), seoulAt("2026-11-15")];
    // When
    const results = clocks.map((clock) => resolveTodoSchedule(input, clock));
    // Then
    expect(results).toMatchObject([
      { startDate: "2026-11-07", endDate: null, warnings: [] },
      { startDate: "2026-11-15", endDate: "2026-12-01", warnings: [] },
    ]);
  });
});

describe("resolveTodoSchedule — 모델이 흔들린 표현에서도 예측 가능한 결과", () => {
  it("때와 함께 온 relativeMinutes 0은 '지금'이 아니라 말한 날짜와 때로 계산한다", () => {
    // Given - 서울 수 10:00에 "내일 아침 치과 예약 전화"를 모델이 relativeMinutes 0과 함께 냄
    const input = draft({
      date: { kind: "OFFSET_DAYS", amount: 1 },
      time: { partOfDay: "MORNING", relativeMinutes: 0 },
    });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-29", scheduledTime: "09:00" });
  });

  it("relativeMinutes 0만 있으면 지금 시각을 만들지 않고 종일로 둔다", () => {
    // Given
    const input = draft({ time: { relativeMinutes: 0 } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-28", scheduledTime: null, isAllDay: true });
  });

  it("다른 날을 말한 표현과 함께 온 상대 시각은 무시하고 말한 날짜를 지킨다", () => {
    // Given - "내일"과 120분 뒤가 함께 오면 오늘 12:00이 아니라 내일이다
    const input = draft({
      date: { kind: "OFFSET_DAYS", amount: 1 },
      time: { relativeMinutes: 120 },
    });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-29", isAllDay: true });
  });

  it("오늘을 말한 상대 시각은 그대로 지금부터 계산한다", () => {
    // Given - "오늘 2시간 뒤"
    const input = draft({ date: { kind: "TODAY" }, time: { relativeMinutes: 120 } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-28", scheduledTime: "12:00" });
  });

  it("날짜 없이 말한 때가 오늘 이미 지났으면 내일 그 때로 넘긴다", () => {
    // Given - 서울 10:00에 "아침에 영양제 먹기"
    const input = draft({ time: { partOfDay: "MORNING" } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-29", scheduledTime: "09:00" });
  });

  it("'오늘 아침'이 이미 지났으면 오늘로 두고 지난 기본 시각을 넣지 않는다", () => {
    // Given - 서울 10:00에 "오늘 아침 영양제 먹기"
    const input = draft({ date: { kind: "TODAY" }, time: { partOfDay: "MORNING" } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-28", scheduledTime: null, isAllDay: true });
  });

  it("'오늘 저녁'처럼 아직 오지 않은 때는 오늘 기본 시각을 넣는다", () => {
    // Given
    const input = draft({ date: { kind: "TODAY" }, time: { partOfDay: "EVENING" } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-28", scheduledTime: "19:00" });
  });

  it("오늘 지난 시각을 숫자로 말하면 사용자가 말한 그대로 둔다", () => {
    // Given - 서울 10:00에 "오늘 오전 9시 약 먹기"
    const input = draft({ date: { kind: "TODAY" }, time: { hour: 9, minute: 0, meridiem: "AM" } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result).toMatchObject({ startDate: "2026-10-28", scheduledTime: "09:00" });
  });
});

describe("resolveTodoSchedule — 반복 할 일 전용 표현", () => {
  it.each([
    { pattern: "BIWEEKLY_DAYS", daysOfWeek: ["TUE"] },
    { pattern: "MONTHLY_DAY", monthDay: 15 },
  ] as const)(
    "$pattern은 출시 parse 응답의 요일 반복으로 바꾸지 않고 지원하지 않는 반복으로 알린다",
    (repeat) => {
      // Given
      const input = draft({ date: { kind: "OFFSET_DAYS", amount: 1 }, repeat });
      // When
      const result = resolveTodoSchedule(input, SEOUL);
      // Then
      expect(result).toMatchObject({
        startDate: "2026-10-29",
        isRecurring: false,
        recurrence: null,
        warnings: ["UNSUPPORTED_RECURRENCE"],
      });
    },
  );
});

describe("resolveTodoSchedule — 반복 규칙 (서울 수 2026-10-28)", () => {
  it.each([
    {
      name: "매일, 종료 언급 없음 → 계속 반복",
      repeat: { pattern: "DAILY" },
      expected: { frequency: "DAILY", end: { type: "NEVER" } },
    },
    {
      name: "평일 → 매주 월~금",
      repeat: { pattern: "WEEKDAYS" },
      expected: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON", "TUE", "WED", "THU", "FRI"],
        end: { type: "NEVER" },
      },
    },
    {
      name: "주말 → 매주 토·일",
      repeat: { pattern: "WEEKENDS" },
      expected: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["SAT", "SUN"],
        end: { type: "NEVER" },
      },
    },
    {
      name: "요일 + 날짜까지",
      repeat: {
        pattern: "WEEKLY_DAYS",
        daysOfWeek: ["WED", "MON"],
        until: { kind: "CALENDAR_DATE", year: 2_026, month: 12, day: 31 },
      },
      expected: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON", "WED"],
        end: { type: "UNTIL", date: "2026-12-31" },
      },
    },
    {
      name: "요일 + 2주 동안 → 그 기간 끝 날까지",
      repeat: {
        pattern: "WEEKLY_DAYS",
        daysOfWeek: ["MON"],
        forDuration: { unit: "WEEK", amount: 2 },
      },
      expected: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["MON"],
        end: { type: "UNTIL", date: "2026-11-10" },
      },
    },
    {
      name: "이번 주 → 짧은 매주 + 일요일까지",
      repeat: { pattern: "THIS_WEEK" },
      expected: {
        frequency: "WEEKLY",
        interval: 1,
        weekdays: ["WED", "THU", "FRI", "SAT", "SUN"],
        end: { type: "UNTIL", date: "2026-11-01" },
      },
    },
    {
      name: "격주",
      repeat: { pattern: "BIWEEKLY_DAYS", daysOfWeek: ["TUE"] },
      expected: { frequency: "WEEKLY", interval: 2, weekdays: ["TUE"], end: { type: "NEVER" } },
    },
    { name: "반복 아님", repeat: { pattern: "NONE" }, expected: null },
    { name: "나타낼 수 없는 반복", repeat: { pattern: "UNSUPPORTED" }, expected: null },
    { name: "요일 없는 매주", repeat: { pattern: "WEEKLY_DAYS" }, expected: null },
  ] as const)("$name", ({ repeat, expected }) => {
    // Given
    const input = scheduleDraftFixture({ repeat: { ...repeat } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result.repeat).toEqual(expected);
  });

  it("매월 n일은 말한 날짜를 쓰고 없으면 시작일의 날짜를 쓴다", () => {
    // Given
    const said = {
      ...draft(),
      repeat: planRepeatRefFixture({ pattern: "MONTHLY_DAY", monthDay: 15 }),
    };
    const unsaid = { ...draft(), repeat: planRepeatRefFixture({ pattern: "MONTHLY_DAY" }) };
    // When
    const results = [said, unsaid].map((input) => resolveTodoSchedule(input, SEOUL).repeat);
    // Then
    expect(results).toEqual([
      { frequency: "MONTHLY", monthDay: 15, end: { type: "NEVER" } },
      { frequency: "MONTHLY", monthDay: 28, end: { type: "NEVER" } },
    ]);
  });

  it.each([
    {
      why: "until이 시작일과 같은 날",
      repeat: { pattern: "DAILY", until: { kind: "TODAY" } },
    },
    {
      why: "until이 시작일보다 앞선 날",
      repeat: {
        pattern: "DAILY",
        until: { kind: "CALENDAR_DATE", year: 2_026, month: 10, day: 1 },
      },
    },
    {
      why: "기간이 하루뿐인 forDuration",
      repeat: { pattern: "DAILY", forDuration: { unit: "DAY", amount: 1 } },
    },
  ] as const)("$why이면 말하지 않은 것으로 보고 계속 반복한다", ({ repeat }) => {
    // Given
    const input = draft({ repeat });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result.repeat).toEqual({ frequency: "DAILY", end: { type: "NEVER" } });
    expect(result.recurrence?.endDate).toBe("2026-11-25");
    expect(result.warnings).toContain("REPEAT_END_NOT_AFTER_START");
  });

  it("시작일 다음 날까지인 until은 말한 대로 끝낸다", () => {
    // Given
    const input = draft({
      repeat: { pattern: "DAILY", until: { kind: "OFFSET_DAYS", amount: 1 } },
    });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result.repeat).toEqual({
      frequency: "DAILY",
      end: { type: "UNTIL", date: "2026-10-29" },
    });
    expect(result.warnings).not.toContain("REPEAT_END_NOT_AFTER_START");
  });

  it("일요일에 말한 이번 주말은 기간을 말한 것이라 그날로 끝낸다", () => {
    // Given
    const sunday = { now: new Date("2026-11-01T01:00:00Z"), timeZone: "Asia/Seoul" };
    const input = draft({ repeat: { pattern: "THIS_WEEKEND" } });
    // When
    const result = resolveTodoSchedule(input, sunday);
    // Then
    expect(result.repeat).toMatchObject({ end: { type: "UNTIL", date: "2026-11-01" } });
    expect(result.warnings).not.toContain("REPEAT_END_NOT_AFTER_START");
  });

  it("종료를 말하지 않아도 출시 앱용 recurrence는 기본 +4주를 유지한다", () => {
    // Given
    const input = draft({ repeat: { pattern: "DAILY" } });
    // When
    const result = resolveTodoSchedule(input, SEOUL);
    // Then
    expect(result.recurrence?.endDate).toBe("2026-11-25");
    expect(result.repeat).toEqual({ frequency: "DAILY", end: { type: "NEVER" } });
  });
});

describe("resolvePlanSchedule — 계획의 주말", () => {
  // 2026-11-05 목요일, 2026-11-07 토요일, 2026-11-08 일요일 (서울)
  const THURSDAY = { now: new Date("2026-11-05T01:00:00Z"), timeZone: "Asia/Seoul" };
  const SATURDAY = { now: new Date("2026-11-07T01:00:00Z"), timeZone: "Asia/Seoul" };
  const SUNDAY = { now: new Date("2026-11-08T01:00:00Z"), timeZone: "Asia/Seoul" };

  it.each([
    { name: "주중에 말한 주말은 다가오는 토요일", clock: THURSDAY, expected: "2026-11-07" },
    { name: "토요일에 말한 주말은 오늘", clock: SATURDAY, expected: "2026-11-07" },
    { name: "일요일에 말한 이번 주말은 오늘", clock: SUNDAY, expected: "2026-11-08" },
  ])("$name 한 번이고 반복이 아니다", ({ clock, expected }) => {
    // Given
    const input = { ...draft(), repeat: planRepeatRefFixture({ pattern: "THIS_WEEKEND" }) };
    // When
    const result = resolvePlanSchedule(input, clock);
    // Then
    expect(result).toMatchObject({
      startDate: expected,
      endDate: null,
      isRecurring: false,
      recurrence: null,
      repeat: null,
    });
  });

  it("다음 주말은 다음 주 토요일 한 번이다", () => {
    // Given
    const input = { ...draft(), repeat: planRepeatRefFixture({ pattern: "NEXT_WEEKEND" }) };
    // When
    const result = resolvePlanSchedule(input, THURSDAY);
    // Then
    expect(result).toMatchObject({ startDate: "2026-11-14", repeat: null, recurrence: null });
  });

  it("주말마다는 끝 없는 반복이다", () => {
    // Given
    const input = { ...draft(), repeat: planRepeatRefFixture({ pattern: "WEEKENDS" }) };
    // When
    const result = resolvePlanSchedule(input, THURSDAY);
    // Then
    expect(result.repeat).toEqual({
      frequency: "WEEKLY",
      interval: 1,
      weekdays: ["SAT", "SUN"],
      end: { type: "NEVER" },
    });
  });

  it("출시 parse 응답의 이번 주말은 요일과 종료일을 그대로 준다", () => {
    // Given
    const input = draft({ repeat: { pattern: "THIS_WEEKEND" } });
    // When
    const result = resolveTodoSchedule(input, THURSDAY);
    // Then
    expect(result.recurrence).toEqual({ daysOfWeek: ["SAT", "SUN"], endDate: "2026-11-08" });
  });
});
