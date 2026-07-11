/**
 * Streak 애그리게잇 단위 테스트 (전이 규칙)
 */
import { Streak } from "./streak.entity";

const TODAY = new Date("2024-01-16T00:00:00.000Z");
const YESTERDAY = new Date("2024-01-15T00:00:00.000Z");
const TWO_DAYS_AGO = new Date("2024-01-14T00:00:00.000Z");

describe("Streak", () => {
	describe("planCompletion", () => {
		it("오늘 이미 완료 반영이면 null(무변경)", () => {
			const streak = Streak.of({
				currentStreak: 5,
				longestStreak: 9,
				lastCompletedDate: TODAY,
			});
			expect(streak.planCompletion(TODAY)).toBeNull();
		});

		it("어제 완료 → 연속 증가(+1), longest 갱신", () => {
			const streak = Streak.of({
				currentStreak: 9,
				longestStreak: 9,
				lastCompletedDate: YESTERDAY,
			});
			const plan = streak.planCompletion(TODAY);
			expect(plan?.nextState).toEqual({
				currentStreak: 10,
				longestStreak: 10,
				lastCompletedDate: TODAY,
			});
			expect(plan?.reachedStreak3).toBe(false);
		});

		it("연속 아님 → 스트릭 1로 새 시작", () => {
			const streak = Streak.of({
				currentStreak: 4,
				longestStreak: 8,
				lastCompletedDate: TWO_DAYS_AGO,
			});
			const plan = streak.planCompletion(TODAY);
			expect(plan?.nextState).toEqual({
				currentStreak: 1,
				longestStreak: 8,
				lastCompletedDate: TODAY,
			});
		});

		it("3일 연속 도달 시 reachedStreak3=true", () => {
			const streak = Streak.of({
				currentStreak: 2,
				longestStreak: 2,
				lastCompletedDate: YESTERDAY,
			});
			expect(streak.planCompletion(TODAY)?.reachedStreak3).toBe(true);
		});
	});

	describe("planUncompletion", () => {
		it("오늘 완료 반영이 없으면 null(무변경)", () => {
			const streak = Streak.of({
				currentStreak: 5,
				longestStreak: 9,
				lastCompletedDate: YESTERDAY,
			});
			expect(streak.planUncompletion(TODAY, true)).toBeNull();
		});

		it("어제도 완료였으면 오늘만 제거(스트릭 -1, lastCompleted=어제)", () => {
			const streak = Streak.of({
				currentStreak: 5,
				longestStreak: 9,
				lastCompletedDate: TODAY,
			});
			expect(streak.planUncompletion(TODAY, true)).toEqual({
				currentStreak: 4,
				longestStreak: 9,
				lastCompletedDate: YESTERDAY,
			});
		});

		it("어제 완료가 아니었으면 스트릭 리셋(0, null)", () => {
			const streak = Streak.of({
				currentStreak: 1,
				longestStreak: 9,
				lastCompletedDate: TODAY,
			});
			expect(streak.planUncompletion(TODAY, false)).toEqual({
				currentStreak: 0,
				longestStreak: 9,
				lastCompletedDate: null,
			});
		});
	});

	describe("isCompletedOn", () => {
		it("lastCompletedDate가 today면 true", () => {
			expect(
				Streak.of({
					currentStreak: 1,
					longestStreak: 1,
					lastCompletedDate: TODAY,
				}).isCompletedOn(TODAY),
			).toBe(true);
		});

		it("lastCompletedDate가 null이면 false", () => {
			expect(
				Streak.of({
					currentStreak: 0,
					longestStreak: 0,
					lastCompletedDate: null,
				}).isCompletedOn(TODAY),
			).toBe(false);
		});
	});
});
