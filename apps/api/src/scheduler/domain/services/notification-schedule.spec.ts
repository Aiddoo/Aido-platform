import {
	isWithinScheduleWindow,
	matchesScheduleTime,
	NOTIFICATION_SCHEDULE,
	SCHEDULE_GRACE_MINUTES,
} from "./notification-schedule";

describe("notification-schedule", () => {
	describe("matchesScheduleTime (정확 일치 — 기존 계약 보존)", () => {
		it("시:분이 정확히 일치할 때만 true", () => {
			const schedule = { hour: 11, minute: 30 };
			expect(matchesScheduleTime(schedule, 11, 30)).toBe(true);
			expect(matchesScheduleTime(schedule, 11, 29)).toBe(false);
			expect(matchesScheduleTime(schedule, 11, 31)).toBe(false);
			expect(matchesScheduleTime(schedule, 12, 30)).toBe(false);
		});
	});

	describe("isWithinScheduleWindow (미스-분 캐치업 grace)", () => {
		const schedule = NOTIFICATION_SCHEDULE.WEEKLY_REPORT; // 11:30

		it("정각(슬롯 시작)에는 발송 창 안이다", () => {
			expect(isWithinScheduleWindow(schedule, 11, 30)).toBe(true);
		});

		it("슬롯 직전 1분은 창 밖이다", () => {
			expect(isWithinScheduleWindow(schedule, 11, 29)).toBe(false);
		});

		it("기본 grace(3분) 안의 지연된 분들도 창 안이다", () => {
			expect(isWithinScheduleWindow(schedule, 11, 31)).toBe(true);
			expect(isWithinScheduleWindow(schedule, 11, 32)).toBe(true);
		});

		it("grace 경계(시작+grace)는 배타적이라 창 밖이다", () => {
			// 기본 grace 3분: 11:33은 발송 안 함(11:30~11:32까지만)
			expect(SCHEDULE_GRACE_MINUTES).toBe(3);
			expect(isWithinScheduleWindow(schedule, 11, 33)).toBe(false);
		});

		it("grace 파라미터를 좁히면 정각만 매칭한다", () => {
			expect(isWithinScheduleWindow(schedule, 11, 30, 1)).toBe(true);
			expect(isWithinScheduleWindow(schedule, 11, 31, 1)).toBe(false);
		});

		it("분→시 경계를 넘겨도 절대 분(minute-of-day)으로 올바르게 판정한다", () => {
			const nearHourEnd = { hour: 11, minute: 59 };
			expect(isWithinScheduleWindow(nearHourEnd, 11, 59)).toBe(true);
			expect(isWithinScheduleWindow(nearHourEnd, 12, 0)).toBe(true); // +1분
			expect(isWithinScheduleWindow(nearHourEnd, 12, 1)).toBe(true); // +2분
			expect(isWithinScheduleWindow(nearHourEnd, 12, 2)).toBe(false); // +3분(배타)
		});
	});
});
