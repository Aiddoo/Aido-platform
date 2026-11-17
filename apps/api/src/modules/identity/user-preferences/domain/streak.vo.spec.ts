/**
 * Streak 값 객체 단위 테스트 (전이 규칙)
 */
import { Streak } from "./streak.vo.js";

const TODAY = Temporal.PlainDate.from("2024-01-16");
const YESTERDAY = Temporal.PlainDate.from("2024-01-15");
const TWO_DAYS_AGO = Temporal.PlainDate.from("2024-01-14");

describe("Streak", () => {
  describe("planCompletion", () => {
    it("오늘 이미 완료 반영이면 null(무변경)", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 5,
        longestStreak: 9,
        lastCompletedDate: TODAY,
      });

      // When
      const plan = streak.planCompletion(TODAY);

      // Then
      expect(plan).toBeNull();
    });

    it("어제 완료 → 연속 증가(+1), longest 갱신", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 9,
        longestStreak: 9,
        lastCompletedDate: YESTERDAY,
      });

      // When
      const plan = streak.planCompletion(TODAY);

      // Then
      expect(plan?.nextState).toEqual({
        currentStreak: 10,
        longestStreak: 10,
        lastCompletedDate: TODAY,
      });
      expect(plan?.reachedStreak3).toBe(false);
    });

    it("연속 아님 → 스트릭 1로 새 시작", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 4,
        longestStreak: 8,
        lastCompletedDate: TWO_DAYS_AGO,
      });

      // When
      const plan = streak.planCompletion(TODAY);

      // Then
      expect(plan?.nextState).toEqual({
        currentStreak: 1,
        longestStreak: 8,
        lastCompletedDate: TODAY,
      });
    });

    it("3일 연속 도달 시 reachedStreak3=true", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 2,
        longestStreak: 2,
        lastCompletedDate: YESTERDAY,
      });

      // When
      const plan = streak.planCompletion(TODAY);

      // Then
      expect(plan?.reachedStreak3).toBe(true);
    });
  });

  describe("planUncompletion", () => {
    it("오늘 완료 반영이 없으면 null(무변경)", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 5,
        longestStreak: 9,
        lastCompletedDate: YESTERDAY,
      });

      // When
      const nextState = streak.planUncompletion(TODAY, true);

      // Then
      expect(nextState).toBeNull();
    });

    it("어제도 완료였으면 오늘만 제거(스트릭 -1, lastCompleted=어제)", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 5,
        longestStreak: 9,
        lastCompletedDate: TODAY,
      });

      // When
      const nextState = streak.planUncompletion(TODAY, true);

      // Then
      expect(nextState).toEqual({
        currentStreak: 4,
        longestStreak: 9,
        lastCompletedDate: YESTERDAY,
      });
    });

    it("어제 완료가 아니었으면 스트릭 리셋(0, null)", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 1,
        longestStreak: 9,
        lastCompletedDate: TODAY,
      });

      // When
      const nextState = streak.planUncompletion(TODAY, false);

      // Then
      expect(nextState).toEqual({
        currentStreak: 0,
        longestStreak: 9,
        lastCompletedDate: null,
      });
    });
  });

  describe("isCompletedOn", () => {
    it("lastCompletedDate가 today면 true", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedDate: TODAY,
      });

      // When
      const result = streak.isCompletedOn(TODAY);

      // Then
      expect(result).toBe(true);
    });

    it("lastCompletedDate가 null이면 false", () => {
      // Given
      const streak = Streak.reconstitute({
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null,
      });

      // When
      const result = streak.isCompletedOn(TODAY);

      // Then
      expect(result).toBe(false);
    });
  });
});

describe("Streak — 시간대 이동과 달력 경계", () => {
  const plainDate = (iso: string) => Temporal.PlainDate.from(iso);

  it("서쪽으로 이동해 오늘이 마지막 완료일보다 앞서면 이미 센 날로 보고 바꾸지 않는다", () => {
    // Given
    const streak = Streak.reconstitute({
      currentStreak: 4,
      longestStreak: 4,
      lastCompletedDate: plainDate("2027-01-01"),
    });

    // When
    const plan = streak.planCompletion(plainDate("2026-12-31"));

    // Then
    expect(plan).toBeNull();
  });

  it("동쪽으로 이동해 현지 날짜가 하루를 건너뛰면 연속이 끊겨 1부터 다시 센다", () => {
    // Given
    const streak = Streak.reconstitute({
      currentStreak: 4,
      longestStreak: 6,
      lastCompletedDate: plainDate("2027-01-01"),
    });

    // When
    const plan = streak.planCompletion(plainDate("2027-01-03"));

    // Then
    expect(plan?.nextState).toEqual({
      currentStreak: 1,
      longestStreak: 6,
      lastCompletedDate: plainDate("2027-01-03"),
    });
  });

  it("12월 31일 다음 1월 1일 완료는 연속으로 센다", () => {
    // Given
    const streak = Streak.reconstitute({
      currentStreak: 2,
      longestStreak: 2,
      lastCompletedDate: plainDate("2026-12-31"),
    });

    // When
    const plan = streak.planCompletion(plainDate("2027-01-01"));

    // Then
    expect(plan).toEqual({
      nextState: {
        currentStreak: 3,
        longestStreak: 3,
        lastCompletedDate: plainDate("2027-01-01"),
      },
      reachedStreak3: true,
    });
  });

  it("윤년 2월 28일·29일·3월 1일 완료는 하루씩 이어진다", () => {
    // Given
    const days = ["2028-02-28", "2028-02-29", "2028-03-01"].map(plainDate);
    let streak = Streak.reconstitute({
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
    });

    // When
    const streaks = days.map((day) => {
      const plan = streak.planCompletion(day);
      if (plan != null) {
        streak = Streak.reconstitute(plan.nextState);
      }
      return streak.currentStreak;
    });

    // Then
    expect(streaks).toEqual([1, 2, 3]);
    expect(streak.lastCompletedDate).toEqual(plainDate("2028-03-01"));
  });
});
