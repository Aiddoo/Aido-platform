/**
 * 습관 형성 분석기
 *
 * 투두 데이터에서 반복 패턴을 감지하고 습관 형성 상태를 분류합니다.
 * classifyHabit: 단일 습관의 상태를 판정하는 순수 함수
 * analyzeHabitFormation: 전체 투두 데이터를 수집·분류하는 오케스트레이션 함수
 */

import dayjs from "dayjs";

// ============================================================================
// 타입
// ============================================================================

export type HabitStatus = "ESTABLISHED" | "FORMING" | "AT_RISK" | "NONE";

export interface HabitFormationData {
	readonly forming: ReadonlyArray<{
		title: string;
		weekCount: number;
		completionRate: number;
	}>;
	readonly established: ReadonlyArray<{
		title: string;
		weekCount: number;
	}>;
	readonly atRisk: ReadonlyArray<{
		title: string;
		missedWeeks: number;
	}>;
}

export interface HabitTrackerInput {
	readonly title: string;
	readonly startDate: Date;
	readonly completed: boolean;
}

interface HabitClassifyParams {
	readonly consecutiveCount: number;
	readonly completionRate: number;
	readonly missedWeeks: number;
}

// ============================================================================
// 분류 (순수 함수 — 단일 책임: 판정만)
// ============================================================================

/**
 * 단일 습관의 형성 상태를 판정
 *
 * - AT_RISK: 3주+ 하다가 2주+ 빠짐 (가장 먼저 체크 — 긴급)
 * - ESTABLISHED: 3주+ 연속 + 완료율 80%+
 * - FORMING: 2주+ 연속
 * - NONE: 해당 없음
 */
export function classifyHabit(params: HabitClassifyParams): HabitStatus {
	const { consecutiveCount, completionRate, missedWeeks } = params;

	if (consecutiveCount >= 3 && missedWeeks >= 2) {
		return "AT_RISK";
	}
	if (consecutiveCount >= 3 && completionRate >= 80 && missedWeeks <= 1) {
		return "ESTABLISHED";
	}
	if (consecutiveCount >= 2 && missedWeeks <= 1) {
		return "FORMING";
	}
	return "NONE";
}

// ============================================================================
// 분석 (오케스트레이션 — 데이터 수집 + 분류 조합)
// ============================================================================

/**
 * 습관 형성 상태 분석
 *
 * 투두 데이터를 제목별·주차별로 그룹핑한 뒤 classifyHabit으로 분류합니다.
 */
export function analyzeHabitFormation(
	todos: readonly HabitTrackerInput[],
	timezone: string,
): HabitFormationData {
	const titleWeekMap = groupByTitleAndWeek(todos, timezone);
	const currentWeek = dayjs().tz(timezone).isoWeek();

	const forming: HabitFormationData["forming"][number][] = [];
	const established: HabitFormationData["established"][number][] = [];
	const atRisk: HabitFormationData["atRisk"][number][] = [];

	for (const [title, weekMap] of titleWeekMap) {
		const weeks = Array.from(weekMap.keys()).sort((a, b) => a - b);
		if (weeks.length < 2) {
			continue;
		}

		const consecutiveCount = countConsecutiveWeeks(weeks);
		const completionRate = computeCompletionRate(weekMap);
		const lastWeek = weeks[weeks.length - 1];
		const missedWeeks = lastWeek !== undefined ? currentWeek - lastWeek : 0;

		const status = classifyHabit({
			consecutiveCount,
			completionRate,
			missedWeeks,
		});

		switch (status) {
			case "ESTABLISHED":
				established.push({ title, weekCount: consecutiveCount });
				break;
			case "FORMING":
				forming.push({ title, weekCount: consecutiveCount, completionRate });
				break;
			case "AT_RISK":
				atRisk.push({ title, missedWeeks });
				break;
		}
	}

	return { forming, established, atRisk };
}

// ============================================================================
// 내부 헬퍼 (private)
// ============================================================================

function groupByTitleAndWeek(
	todos: readonly HabitTrackerInput[],
	timezone: string,
): Map<string, Map<number, { total: number; completed: number }>> {
	const map = new Map<
		string,
		Map<number, { total: number; completed: number }>
	>();

	for (const todo of todos) {
		const week = dayjs(todo.startDate).tz(timezone).isoWeek();

		if (!map.has(todo.title)) {
			map.set(todo.title, new Map());
		}
		const weekMap = map.get(todo.title)!;

		if (!weekMap.has(week)) {
			weekMap.set(week, { total: 0, completed: 0 });
		}
		const entry = weekMap.get(week)!;
		entry.total++;
		if (todo.completed) {
			entry.completed++;
		}
	}

	return map;
}

function countConsecutiveWeeks(sortedWeeks: number[]): number {
	let count = 1;
	for (let i = sortedWeeks.length - 1; i > 0; i--) {
		if (sortedWeeks[i]! - sortedWeeks[i - 1]! === 1) {
			count++;
		} else {
			break;
		}
	}
	return count;
}

function computeCompletionRate(
	weekMap: Map<number, { total: number; completed: number }>,
): number {
	const totalAll = Array.from(weekMap.values()).reduce(
		(s, w) => s + w.total,
		0,
	);
	const completedAll = Array.from(weekMap.values()).reduce(
		(s, w) => s + w.completed,
		0,
	);
	return totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;
}
