import {
  isWithinScheduleWindow,
  matchesScheduleTime,
  NOTIFICATION_SCHEDULE,
  SCHEDULE_GRACE_MINUTES,
} from "./notification-schedule.domain-service.js";

describe("notification-schedule", () => {
  describe("matchesScheduleTime (정확 일치 — 기존 계약 보존)", () => {
    it("시:분이 정확히 일치할 때만 true", () => {
      // Given
      const schedule = { hour: 11, minute: 30 };

      // When
      const exact = matchesScheduleTime(schedule, 11, 30);
      const oneMinuteEarly = matchesScheduleTime(schedule, 11, 29);
      const oneMinuteLate = matchesScheduleTime(schedule, 11, 31);
      const oneHourLate = matchesScheduleTime(schedule, 12, 30);

      // Then
      expect(exact).toBe(true);
      expect(oneMinuteEarly).toBe(false);
      expect(oneMinuteLate).toBe(false);
      expect(oneHourLate).toBe(false);
    });
  });

  describe("isWithinScheduleWindow (미스-분 캐치업 grace)", () => {
    const schedule = NOTIFICATION_SCHEDULE.WEEKLY_REPORT; // 11:30

    it("정각(슬롯 시작)에는 발송 창 안이다", () => {
      // When
      const result = isWithinScheduleWindow(schedule, 11, 30);

      // Then
      expect(result).toBe(true);
    });

    it("슬롯 직전 1분은 창 밖이다", () => {
      // When
      const result = isWithinScheduleWindow(schedule, 11, 29);

      // Then
      expect(result).toBe(false);
    });

    it("기본 grace(3분) 안의 지연된 분들도 창 안이다", () => {
      // When
      const oneMinuteLate = isWithinScheduleWindow(schedule, 11, 31);
      const twoMinutesLate = isWithinScheduleWindow(schedule, 11, 32);

      // Then
      expect(oneMinuteLate).toBe(true);
      expect(twoMinutesLate).toBe(true);
    });

    it("grace 경계(시작+grace)는 배타적이라 창 밖이다", () => {
      // When
      const graceMinutes = SCHEDULE_GRACE_MINUTES;
      const result = isWithinScheduleWindow(schedule, 11, 33);

      // Then
      // 기본 grace 3분: 11:33은 발송 안 함(11:30~11:32까지만)
      expect(graceMinutes).toBe(3);
      expect(result).toBe(false);
    });

    it("grace 파라미터를 좁히면 정각만 매칭한다", () => {
      // When
      const exact = isWithinScheduleWindow(schedule, 11, 30, 1);
      const oneMinuteLate = isWithinScheduleWindow(schedule, 11, 31, 1);

      // Then
      expect(exact).toBe(true);
      expect(oneMinuteLate).toBe(false);
    });

    it("분→시 경계를 넘겨도 절대 분(minute-of-day)으로 올바르게 판정한다", () => {
      // Given
      const nearHourEnd = { hour: 11, minute: 59 };

      // When
      const atStart = isWithinScheduleWindow(nearHourEnd, 11, 59);
      const oneMinuteLate = isWithinScheduleWindow(nearHourEnd, 12, 0); // +1분
      const twoMinutesLate = isWithinScheduleWindow(nearHourEnd, 12, 1); // +2분
      const threeMinutesLate = isWithinScheduleWindow(nearHourEnd, 12, 2); // +3분(배타)

      // Then
      expect(atStart).toBe(true);
      expect(oneMinuteLate).toBe(true);
      expect(twoMinutesLate).toBe(true);
      expect(threeMinutesLate).toBe(false);
    });
  });
});
