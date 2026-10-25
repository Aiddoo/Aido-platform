import type { ScheduleDraft } from "../../types/parsing/todo-draft.types.js";
import { resolveTodoSchedule } from "./resolve-todo-schedule.js";

// 같은 순간을 두 시간대로 해석한다: 서울 2026-10-28(수) 10:00, LA 2026-10-27(화) 18:00
const NOW = new Date("2026-10-28T01:00:00Z");
const SEOUL = { now: NOW, timeZone: "Asia/Seoul" };
const LOS_ANGELES = { now: NOW, timeZone: "America/Los_Angeles" };

const none = { pattern: "NONE" } as const;
const draft = (overrides: Partial<ScheduleDraft>): ScheduleDraft => ({
  date: { kind: "NONE" },
  time: null,
  repeat: none,
  ...overrides,
});

describe("resolveTodoSchedule — ko golden (서울 수 10:00)", () => {
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
    const input = draft({ date: { kind: "CALENDAR_DATE", year: 2026, month: 2, day: 30 } });
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
