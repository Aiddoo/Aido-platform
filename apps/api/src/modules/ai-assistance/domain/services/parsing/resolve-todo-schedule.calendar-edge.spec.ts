import type { ScheduleDraft } from "../../types/parsing/todo-draft.types.js";
import { resolveTodoSchedule } from "./resolve-todo-schedule.js";

const SEOUL = "Asia/Seoul";
const LOS_ANGELES = "America/Los_Angeles";

const none = { pattern: "NONE" } as const;
const draft = (overrides: Partial<ScheduleDraft>): ScheduleDraft => ({
  date: { kind: "NONE" },
  time: null,
  repeat: none,
  ...overrides,
});
const resolveAt = (iso: string, timeZone: string, input: ScheduleDraft) =>
  resolveTodoSchedule(input, { now: new Date(iso), timeZone });

const tomorrow = draft({ date: { kind: "OFFSET_DAYS", amount: 1 } });

describe("resolveTodoSchedule — 윤일", () => {
  // 서울 2028-02-28(월) 12:00
  const NOW = "2028-02-28T03:00:00Z";

  it.each([
    { name: "내일", amount: 1, expected: "2028-02-29" },
    { name: "모레", amount: 2, expected: "2028-03-01" },
    { name: "글피", amount: 3, expected: "2028-03-02" },
  ])("Given 윤년 2월 28일 When $name Then $expected 이다", ({ amount, expected }) => {
    const result = resolveAt(NOW, SEOUL, draft({ date: { kind: "OFFSET_DAYS", amount } }));

    expect(result.startDate).toBe(expected);
  });

  it("Given 평년 2월 28일 When 내일 Then 3월 1일이다", () => {
    const result = resolveAt("2027-02-28T03:00:00Z", SEOUL, tomorrow);

    expect(result.startDate).toBe("2027-03-01");
  });

  it.each([
    { name: "윤년", now: "2028-01-15T03:00:00Z", expected: "2028-02-29" },
    { name: "평년", now: "2027-01-15T03:00:00Z", expected: "2027-02-28" },
  ])("Given $name 1월 When 다음 달 말일 Then $expected 이다", ({ now, expected }) => {
    const result = resolveAt(now, SEOUL, draft({ date: { kind: "MONTH_END", amount: 1 } }));

    expect(result.startDate).toBe(expected);
  });

  it.each([
    { name: "윤년 1월 31일", now: "2028-01-31T03:00:00Z", expected: "2028-02-29" },
    { name: "평년 1월 31일", now: "2027-01-31T03:00:00Z", expected: "2027-02-28" },
    { name: "3월 31일", now: "2028-03-31T03:00:00Z", expected: "2028-04-30" },
    { name: "윤일 2월 29일", now: "2028-02-29T03:00:00Z", expected: "2028-03-29" },
  ])(
    "Given $name When 다음 달 같은 날 Then 없는 날짜는 그 달 말일로 맞춰 $expected 이다",
    ({ now, expected }) => {
      const result = resolveAt(now, SEOUL, draft({ date: { kind: "OFFSET_MONTHS", amount: 1 } }));

      expect(result.startDate).toBe(expected);
    },
  );

  it("Given 윤일 직후 When 2월 29일(월·일만 지정)을 말하면 Then 다음 윤년 2월 29일이다", () => {
    const result = resolveAt(
      "2028-03-01T03:00:00Z",
      SEOUL,
      draft({ date: { kind: "CALENDAR_DATE", month: 2, day: 29 } }),
    );

    expect(result.startDate).toBe("2032-02-29");
  });

  it("Given 평년 When 2월 29일을 연도까지 말하면 Then 없는 날짜라 INVALID_DATE 경고를 남긴다", () => {
    const result = resolveAt(
      "2027-02-01T03:00:00Z",
      SEOUL,
      draft({ date: { kind: "CALENDAR_DATE", year: 2027, month: 2, day: 29 } }),
    );

    expect(result.warnings).toContain("INVALID_DATE");
  });
});

describe("resolveTodoSchedule — ISO 53주차 (2026-12-28 ~ 2027-01-03)", () => {
  const nextFriday = draft({ date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 1 } });

  it.each([
    { name: "12-24(목)", now: "2026-12-24T03:00:00Z", expected: "2027-01-01" },
    { name: "12-28(월, 53주 첫날)", now: "2026-12-28T03:00:00Z", expected: "2027-01-08" },
    { name: "12-14(월, 51주)", now: "2026-12-14T03:00:00Z", expected: "2026-12-25" },
    { name: "2027-01-03(일, 53주 마지막 날)", now: "2027-01-03T03:00:00Z", expected: "2027-01-08" },
  ])("Given 서울 $name When 다음 주 금요일 Then $expected 이다", ({ now, expected }) => {
    const result = resolveAt(now, SEOUL, nextFriday);

    expect(result.startDate).toBe(expected);
  });

  it("Given 53주 월요일 When 다음 주 월요일 Then 새해 첫 월요일 1월 4일이다", () => {
    const result = resolveAt(
      "2026-12-28T03:00:00Z",
      SEOUL,
      draft({ date: { kind: "WEEKDAY", weekday: "MON", weekOffset: 1 } }),
    );

    expect(result.startDate).toBe("2027-01-04");
  });

  it("Given 12-24 When 다음 주 반복 Then 53주 월~일이 시작·종료이다", () => {
    const result = resolveAt(
      "2026-12-24T03:00:00Z",
      SEOUL,
      draft({ repeat: { pattern: "NEXT_WEEK" } }),
    );

    expect(result.startDate).toBe("2026-12-28");
    expect(result.recurrence?.endDate).toBe("2027-01-03");
  });

  it("Given 12-24 When 다다음 주 반복 Then 2027년 1주차(1월 4일 ~ 10일)이다", () => {
    const result = resolveAt(
      "2026-12-24T03:00:00Z",
      SEOUL,
      draft({ repeat: { pattern: "WEEK_AFTER_NEXT" } }),
    );

    expect(result.startDate).toBe("2027-01-04");
    expect(result.recurrence?.endDate).toBe("2027-01-10");
  });

  describe("같은 순간(2027-01-03T16:00Z)의 연말·연초 경계: 서울 월 01:00 vs LA 일 08:00", () => {
    const INSTANT = "2027-01-03T16:00:00Z";

    it.each([
      { zone: SEOUL, expected: "2027-01-05" },
      { zone: LOS_ANGELES, expected: "2027-01-04" },
    ])("When 내일 Then $zone 은 $expected 이다", ({ zone, expected }) => {
      expect(resolveAt(INSTANT, zone, tomorrow).startDate).toBe(expected);
    });

    it.each([
      { zone: SEOUL, expected: "2027-01-08" },
      { zone: LOS_ANGELES, expected: "2027-01-01" },
    ])("When 이번 주 금요일 Then $zone 은 $expected 이다", ({ zone, expected }) => {
      const result = resolveAt(
        INSTANT,
        zone,
        draft({ date: { kind: "WEEKDAY", weekday: "FRI", weekOffset: 0 } }),
      );

      expect(result.startDate).toBe(expected);
    });
  });
});

describe("resolveTodoSchedule — LA 서머타임 경계", () => {
  const tomorrowNineAm = draft({
    date: { kind: "OFFSET_DAYS", amount: 1 },
    time: { hour: 9, minute: 0, meridiem: "AM" },
  });

  it.each([
    {
      name: "봄 전환 전날 저녁(2028-03-11 20:00 PST)",
      now: "2028-03-12T04:00:00Z",
      date: "2028-03-12",
    },
    { name: "봄 전환일 01:30 PST", now: "2028-03-12T09:30:00Z", date: "2028-03-13" },
    { name: "봄 전환일 12:00 PDT", now: "2028-03-12T19:00:00Z", date: "2028-03-13" },
    { name: "가을 전환일 00:30 PDT", now: "2028-11-05T07:30:00Z", date: "2028-11-06" },
    { name: "가을 전환 직후 01:30 PST", now: "2028-11-05T09:30:00Z", date: "2028-11-06" },
    { name: "가을 전환일 23:00 PST", now: "2028-11-06T07:00:00Z", date: "2028-11-06" },
  ])("Given $name When 내일 오전 9시 Then $date 09:00 이다", ({ now, date }) => {
    const result = resolveAt(now, LOS_ANGELES, tomorrowNineAm);

    expect(result.startDate).toBe(date);
    expect(result.scheduledTime).toBe("09:00");
    expect(result.isAllDay).toBe(false);
  });

  it.each([
    { name: "봄 전환일(23시간) 00:00", now: "2028-03-12T08:00:00Z", expected: "2028-03-13" },
    { name: "가을 전환일(25시간) 00:00", now: "2028-11-05T07:00:00Z", expected: "2028-11-06" },
  ])("Given $name When 내일 Then 달력 날짜로 $expected 이다", ({ now, expected }) => {
    expect(resolveAt(now, LOS_ANGELES, tomorrow).startDate).toBe(expected);
  });

  it("Given 봄 전환일 01:45 PST When 30분 뒤 Then 존재하지 않는 02:15가 아니라 03:15이다", () => {
    const result = resolveAt(
      "2028-03-12T09:45:00Z",
      LOS_ANGELES,
      draft({ time: { relativeMinutes: 30 } }),
    );

    expect(result.startDate).toBe("2028-03-12");
    expect(result.scheduledTime).toBe("03:15");
  });

  it("Given 가을 전환일 01:30 PDT When 60분 뒤 Then 한 시간이 반복되어 01:30 PST이다", () => {
    const result = resolveAt(
      "2028-11-05T08:30:00Z",
      LOS_ANGELES,
      draft({ time: { relativeMinutes: 60 } }),
    );

    expect(result.startDate).toBe("2028-11-05");
    expect(result.scheduledTime).toBe("01:30");
  });

  it("Given 가을 전환일 23:30 PST When 60분 뒤 Then 다음 날 00:30이다", () => {
    const result = resolveAt(
      "2028-11-06T07:30:00Z",
      LOS_ANGELES,
      draft({ time: { relativeMinutes: 60 } }),
    );

    expect(result.startDate).toBe("2028-11-06");
    expect(result.scheduledTime).toBe("00:30");
  });
});

describe("resolveTodoSchedule — 자정 경계 (서울 2028-02-28 → 02-29)", () => {
  // 23:59:59 KST = 14:59:59Z, 00:00:00 KST = 15:00:00Z
  it.each([
    { name: "23:59:59", now: "2028-02-28T14:59:59Z", today: "2028-02-28", next: "2028-02-29" },
    { name: "00:00:00", now: "2028-02-28T15:00:00Z", today: "2028-02-29", next: "2028-03-01" },
  ])("Given 서울 $name When 오늘·내일 Then $today·$next 이다", ({ now, today, next }) => {
    expect(resolveAt(now, SEOUL, draft({ date: { kind: "TODAY" } })).startDate).toBe(today);
    expect(resolveAt(now, SEOUL, tomorrow).startDate).toBe(next);
  });

  it("Given 서울 23:59:59 When 날짜 없이 30분 뒤 Then 다음 날 00:29이다", () => {
    const result = resolveAt(
      "2028-02-28T14:59:59Z",
      SEOUL,
      draft({ time: { relativeMinutes: 30 } }),
    );

    expect(result.startDate).toBe("2028-02-29");
    expect(result.scheduledTime).toBe("00:29");
  });

  it("Given 서울 00:00:00 When 날짜 없이 30분 뒤 Then 같은 날 00:30이다", () => {
    const result = resolveAt(
      "2028-02-28T15:00:00Z",
      SEOUL,
      draft({ time: { relativeMinutes: 30 } }),
    );

    expect(result.startDate).toBe("2028-02-29");
    expect(result.scheduledTime).toBe("00:30");
  });

  it.each([
    { name: "23:59:59", now: "2028-02-28T14:59:59Z", date: "2028-02-29" },
    { name: "00:00:00", now: "2028-02-28T15:00:00Z", date: "2028-03-01" },
  ])("Given 서울 $name When 오늘 자정 Then $date 00:00 이다", ({ now, date }) => {
    const result = resolveAt(
      now,
      SEOUL,
      draft({ date: { kind: "TODAY" }, time: { partOfDay: "MIDNIGHT" } }),
    );

    expect(result.startDate).toBe(date);
    expect(result.scheduledTime).toBe("00:00");
  });

  it.each([
    { name: "LA 23:59:59", now: "2028-03-13T06:59:59Z", date: "2028-03-13" },
    { name: "LA 00:00:00", now: "2028-03-13T07:00:00Z", date: "2028-03-14" },
  ])("Given 서머타임 직후 $name When 내일 Then $date 이다", ({ now, date }) => {
    expect(resolveAt(now, LOS_ANGELES, tomorrow).startDate).toBe(date);
  });
});
