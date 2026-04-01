/**
 * 배지 판정기
 *
 * 집계 데이터 기반으로 보고서 배지를 계산합니다.
 * 순수 함수로 구성되어 외부 의존성이 없습니다.
 */

export interface Badge {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly isNew: boolean;
}

export interface BadgeCalculatorInput {
	readonly completionRate: number;
	readonly perfectDays: number;
	readonly activeDays: number;
	readonly streakDays: number;
	readonly weekdayRate: number;
	readonly weekendRate: number;
	readonly peakHour: number | null;
	readonly consistencyScore: number;
	readonly prevConsistencyScore: number | null;
	readonly prevBadgeIds: readonly string[];
}

/**
 * 집계 데이터 기반 배지 목록 계산
 */
export function calculateBadges(input: BadgeCalculatorInput): Badge[] {
	const badges: Badge[] = [];
	const isNew = (id: string): boolean => !input.prevBadgeIds.includes(id);

	if (input.perfectDays === input.activeDays && input.activeDays >= 5) {
		badges.push({
			id: "perfect_week",
			label: "완벽한 한 주!",
			description: "모든 활동일에서 100% 달성",
			isNew: isNew("perfect_week"),
		});
	}

	if (input.streakDays >= 14) {
		badges.push({
			id: "streak_14",
			label: "2주 연속 달성!",
			description: "대단해요, 벌써 2주째!",
			isNew: isNew("streak_14"),
		});
	} else if (input.streakDays >= 7) {
		badges.push({
			id: "streak_7",
			label: "7일 연속 달성!",
			description: "일주일 내내 빈틈없이 해냈어요",
			isNew: isNew("streak_7"),
		});
	}

	if (
		input.peakHour !== null &&
		input.peakHour < 12 &&
		input.completionRate >= 60
	) {
		badges.push({
			id: "early_bird",
			label: "얼리버드",
			description: "오전에 집중력이 폭발해요",
			isNew: isNew("early_bird"),
		});
	}

	if (
		input.peakHour !== null &&
		input.peakHour >= 20 &&
		input.completionRate >= 60
	) {
		badges.push({
			id: "night_owl",
			label: "올빼미",
			description: "밤에 진가를 발휘해요",
			isNew: isNew("night_owl"),
		});
	}

	if (input.weekendRate > input.weekdayRate + 20) {
		badges.push({
			id: "weekend_warrior",
			label: "주말 전사",
			description: "주말에 더 강해지는 타입!",
			isNew: isNew("weekend_warrior"),
		});
	}

	if (
		input.prevConsistencyScore !== null &&
		input.consistencyScore >= input.prevConsistencyScore + 10
	) {
		badges.push({
			id: "consistency_up",
			label: "꾸준함 레벨업!",
			description: "일관성 점수가 크게 올랐어요",
			isNew: isNew("consistency_up"),
		});
	}

	return badges;
}
