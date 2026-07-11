/**
 * calculateBadges 유틸 테스트
 *
 * @description
 * calculateBadges 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test badge-calculator
 * ```
 */
import { type BadgeCalculatorInput, calculateBadges } from "./badge-calculator";

function createInput(
	overrides?: Partial<BadgeCalculatorInput>,
): BadgeCalculatorInput {
	return {
		completionRate: 70,
		perfectDays: 3,
		activeDays: 5,
		streakDays: 5,
		weekdayRate: 70,
		weekendRate: 60,
		peakHour: 10,
		consistencyScore: 65,
		prevConsistencyScore: null,
		prevBadgeIds: [],
		...overrides,
	};
}

describe("calculateBadges", () => {
	it("완벽한 주면 perfect_week 배지를 반환해야 한다", () => {
		// Given
		const input = createInput({ perfectDays: 5, activeDays: 5 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "perfect_week")).toBe(true);
	});

	it("활동일 5일 미만이면 perfect_week를 반환하지 않아야 한다", () => {
		// Given
		const input = createInput({ perfectDays: 3, activeDays: 3 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "perfect_week")).toBe(false);
	});

	it("7일 연속이면 streak_7 배지를 반환해야 한다", () => {
		// Given
		const input = createInput({ streakDays: 7 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "streak_7")).toBe(true);
	});

	it("14일 연속이면 streak_14만 반환하고 streak_7은 반환하지 않아야 한다", () => {
		// Given
		const input = createInput({ streakDays: 14 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "streak_14")).toBe(true);
		expect(badges.some((b) => b.id === "streak_7")).toBe(false);
	});

	it("오전 피크 + 달성률 60%+ 면 early_bird 배지를 반환해야 한다", () => {
		// Given
		const input = createInput({ peakHour: 9, completionRate: 70 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "early_bird")).toBe(true);
	});

	it("달성률 60% 미만이면 early_bird를 반환하지 않아야 한다", () => {
		// Given
		const input = createInput({ peakHour: 9, completionRate: 50 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "early_bird")).toBe(false);
	});

	it("주말 달성률이 주중보다 20%p+ 높으면 weekend_warrior 배지를 반환해야 한다", () => {
		// Given
		const input = createInput({ weekdayRate: 50, weekendRate: 80 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "weekend_warrior")).toBe(true);
	});

	it("일관성 점수가 10+ 향상되면 consistency_up 배지를 반환해야 한다", () => {
		// Given
		const input = createInput({
			consistencyScore: 75,
			prevConsistencyScore: 60,
		});

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "consistency_up")).toBe(true);
	});

	it("이전 배지 목록에 있으면 isNew가 false여야 한다", () => {
		// Given
		const input = createInput({
			streakDays: 7,
			prevBadgeIds: ["streak_7"],
		});

		// When
		const badges = calculateBadges(input);

		// Then
		const streak = badges.find((b) => b.id === "streak_7");
		expect(streak?.isNew).toBe(false);
	});

	it("이전 배지 목록에 없으면 isNew가 true여야 한다", () => {
		// Given
		const input = createInput({ streakDays: 7, prevBadgeIds: [] });

		// When
		const badges = calculateBadges(input);

		// Then
		const streak = badges.find((b) => b.id === "streak_7");
		expect(streak?.isNew).toBe(true);
	});

	it("peakHour가 null이면 early_bird/night_owl을 반환하지 않아야 한다", () => {
		// Given
		const input = createInput({ peakHour: null, completionRate: 90 });

		// When
		const badges = calculateBadges(input);

		// Then
		expect(badges.some((b) => b.id === "early_bird")).toBe(false);
		expect(badges.some((b) => b.id === "night_owl")).toBe(false);
	});
});
