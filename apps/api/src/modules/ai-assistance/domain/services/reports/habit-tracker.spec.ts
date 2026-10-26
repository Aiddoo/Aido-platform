/**
 * classifyHabit 유틸 테스트
 *
 * @description
 * classifyHabit 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test habit-tracker
 * ```
 */
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { vi } from "vitest";

import { analyzeHabitFormation, classifyHabit, type HabitTrackerInput } from "./habit-tracker.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

describe("classifyHabit", () => {
  it("3주+ 연속 + 완료율 80%+ → ESTABLISHED", () => {
    // Given
    const params = { consecutiveCount: 4, completionRate: 90, missedWeeks: 0 };

    // When
    const result = classifyHabit(params);

    // Then
    expect(result).toBe("ESTABLISHED");
  });

  it("2주 연속 + 빠진 주 없음 → FORMING", () => {
    // Given
    const params = { consecutiveCount: 2, completionRate: 60, missedWeeks: 0 };

    // When
    const result = classifyHabit(params);

    // Then
    expect(result).toBe("FORMING");
  });

  it("3주+ 연속이었으나 2주+ 빠짐 → AT_RISK", () => {
    // Given
    const params = { consecutiveCount: 3, completionRate: 85, missedWeeks: 2 };

    // When
    const result = classifyHabit(params);

    // Then
    expect(result).toBe("AT_RISK");
  });

  it("AT_RISK가 ESTABLISHED보다 우선되어야 한다 (3주+ + 80%+ 이지만 2주 빠짐)", () => {
    // Given
    const params = { consecutiveCount: 5, completionRate: 95, missedWeeks: 3 };

    // When
    const result = classifyHabit(params);

    // Then
    expect(result).toBe("AT_RISK");
  });

  it("1주만 연속 → NONE", () => {
    // Given
    const params = { consecutiveCount: 1, completionRate: 100, missedWeeks: 0 };

    // When
    const result = classifyHabit(params);

    // Then
    expect(result).toBe("NONE");
  });

  it("3주 연속 + 완료율 70% (80% 미만) → FORMING", () => {
    // Given
    const params = { consecutiveCount: 3, completionRate: 70, missedWeeks: 0 };

    // When
    const result = classifyHabit(params);

    // Then
    expect(result).toBe("FORMING");
  });
});

describe("analyzeHabitFormation", () => {
  const TZ = "Asia/Seoul";
  const LA = "America/Los_Angeles";
  // 서울 2026-03-24(화)
  const AS_OF = new Date("2026-03-24T00:00:00+09:00");

  function makeTodo(
    title: string,
    date: string,
    completed: boolean,
    timeZone: string = TZ,
  ): HabitTrackerInput {
    return {
      title,
      startDate: dayjs.tz(date, timeZone).toDate(),
      completed,
    };
  }

  it("같은 제목이 2주+ 연속이면 forming에 포함되어야 한다", () => {
    // Given — "운동"이 2주 연속
    const todos = [makeTodo("운동", "2026-03-16", true), makeTodo("운동", "2026-03-23", true)];

    // When
    const result = analyzeHabitFormation(todos, TZ, AS_OF);

    // Then
    expect(result.forming).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "운동", weekCount: 2 })]),
    );
  });

  it("1주만 등장한 항목은 분류하지 않아야 한다", () => {
    // Given
    const todos = [makeTodo("독서", "2026-03-16", true)];

    // When
    const result = analyzeHabitFormation(todos, TZ, AS_OF);

    // Then
    expect(result.forming).toHaveLength(0);
    expect(result.established).toHaveLength(0);
    expect(result.atRisk).toHaveLength(0);
  });

  it("빈 배열이면 모든 카테고리가 빈 배열이어야 한다", () => {
    // Given
    const todos: HabitTrackerInput[] = [];

    // When
    const result = analyzeHabitFormation(todos, TZ, AS_OF);

    // Then
    expect(result).toEqual({
      forming: [],
      established: [],
      atRisk: [],
    });
  });

  it("호출 시각과 관계없이 기준 시각의 주차로 놓친 주를 센다", () => {
    // Given — 3주 연속 뒤 2주를 쉬었고, 호출 시각은 반년 뒤다
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    const todos = ["2026-02-16", "2026-02-23", "2026-03-02"].map((date) =>
      makeTodo("운동", date, true),
    );

    // When
    const result = analyzeHabitFormation(todos, TZ, AS_OF);
    vi.useRealTimers();

    // Then — 3/2 주에서 3/23 주까지 3주 지났다
    expect(result.atRisk).toEqual([{ title: "운동", missedWeeks: 3 }]);
  });

  it("ISO 53주(2026-W53)에서 다음 해 1주(2027-W01)로 이어지는 기록을 연속으로 센다", () => {
    // Given — 2026-12-21(W52), 2026-12-28(W53), 2027-01-04(W01)
    const todos = ["2026-12-21", "2026-12-28", "2027-01-04"].map((date) =>
      makeTodo("영어", date, true),
    );

    // When
    const result = analyzeHabitFormation(todos, TZ, new Date("2027-01-06T12:00:00+09:00"));

    // Then
    expect(result.established).toEqual([{ title: "영어", weekCount: 3 }]);
    expect(result.atRisk).toEqual([]);
  });

  it("연말 기록 뒤 해가 바뀌어도 놓친 주를 음수가 아니라 실제 주 수로 센다", () => {
    // Given — 2026-W48~W50 기록, 기준은 2027-W01
    const todos = ["2026-11-23", "2026-11-30", "2026-12-07"].map((date) =>
      makeTodo("명상", date, true),
    );

    // When
    const result = analyzeHabitFormation(todos, TZ, new Date("2027-01-06T12:00:00+09:00"));

    // Then — W51·W52·W53·W01
    expect(result.atRisk).toEqual([{ title: "명상", missedWeeks: 4 }]);
  });

  it("윤년 2월 29일을 지나는 주도 연속으로 센다", () => {
    // Given — 2028-02-21, 2028-02-29(화), 2028-03-06
    const todos = ["2028-02-21", "2028-02-29", "2028-03-06"].map((date) =>
      makeTodo("러닝", date, true),
    );

    // When
    const result = analyzeHabitFormation(todos, TZ, new Date("2028-03-07T12:00:00+09:00"));

    // Then
    expect(result.established).toEqual([{ title: "러닝", weekCount: 3 }]);
  });

  it("LA DST 시작·종료 주에도 사용자 현지 날짜의 주로 묶는다", () => {
    // Given — DST 시작(2026-03-08 일) 직전 밤과 직후 월요일, DST 종료(2026-11-01 일) 밤
    const spring = [
      makeTodo("산책", "2026-03-01 23:30", true, LA),
      makeTodo("산책", "2026-03-08 23:30", true, LA),
      makeTodo("산책", "2026-03-09 00:30", true, LA),
    ];
    const fall = [
      makeTodo("요가", "2026-10-25 23:30", true, LA),
      makeTodo("요가", "2026-11-01 23:30", true, LA),
    ];

    // When
    const springResult = analyzeHabitFormation(spring, LA, new Date("2026-03-10T12:00:00Z"));
    const fallResult = analyzeHabitFormation(fall, LA, new Date("2026-11-02T20:00:00Z"));

    // Then — 3/1(W09)·3/8(W10)·3/9(W11)은 서로 다른 3주, 10/25·11/1은 연속 2주
    expect(springResult.established).toEqual([{ title: "산책", weekCount: 3 }]);
    expect(fallResult.forming).toEqual([{ title: "요가", weekCount: 2, completionRate: 100 }]);
  });
});
