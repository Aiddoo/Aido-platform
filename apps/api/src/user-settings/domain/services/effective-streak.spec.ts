/**
 * computeEffectiveStreak 단위 테스트 (DB 접근 없는 순수 계산)
 */
import { computeEffectiveStreak } from "./effective-streak";

const TODAY = new Date("2024-01-16T00:00:00.000Z");
const YESTERDAY = new Date("2024-01-15T00:00:00.000Z");

describe("computeEffectiveStreak", () => {
	it("전체 완료 + 오늘 이미 반영 → 현재 스트릭 유지", () => {
		const r = computeEffectiveStreak({
			currentStreak: 5,
			lastCompletedDate: TODAY,
			todosCompleted: 2,
			todosTotal: 2,
			today: TODAY,
		});
		expect(r).toEqual({ streak: 5, isAtRisk: false });
	});

	it("전체 완료 + 어제 완료(미반영) → 스트릭 +1", () => {
		const r = computeEffectiveStreak({
			currentStreak: 5,
			lastCompletedDate: YESTERDAY,
			todosCompleted: 3,
			todosTotal: 3,
			today: TODAY,
		});
		expect(r).toEqual({ streak: 6, isAtRisk: false });
	});

	it("전체 완료 + 연속 아님 → 스트릭 1로 새 시작", () => {
		const r = computeEffectiveStreak({
			currentStreak: 9,
			lastCompletedDate: null,
			todosCompleted: 1,
			todosTotal: 1,
			today: TODAY,
		});
		expect(r).toEqual({ streak: 1, isAtRisk: false });
	});

	it("미완료 + 어제 완료 + 스트릭 2+ → 위기(streak 유지)", () => {
		const r = computeEffectiveStreak({
			currentStreak: 7,
			lastCompletedDate: YESTERDAY,
			todosCompleted: 0,
			todosTotal: 1,
			today: TODAY,
		});
		expect(r).toEqual({ streak: 7, isAtRisk: true });
	});

	it("미완료 + 스트릭 1 → 위기 아님", () => {
		const r = computeEffectiveStreak({
			currentStreak: 1,
			lastCompletedDate: YESTERDAY,
			todosCompleted: 0,
			todosTotal: 2,
			today: TODAY,
		});
		expect(r).toEqual({ streak: 1, isAtRisk: false });
	});

	it("todosTotal 0 → 위기 아님", () => {
		const r = computeEffectiveStreak({
			currentStreak: 5,
			lastCompletedDate: YESTERDAY,
			todosCompleted: 0,
			todosTotal: 0,
			today: TODAY,
		});
		expect(r).toEqual({ streak: 5, isAtRisk: false });
	});
});
