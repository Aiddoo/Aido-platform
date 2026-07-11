/**
 * classifyHabit 유틸 테스트
 *
 * @description
 * classifyHabit 유틸리티를 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test habit-tracker
 * ```
 */
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
	analyzeHabitFormation,
	classifyHabit,
	type HabitTrackerInput,
} from "./habit-tracker";

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

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-03-24T00:00:00+09:00"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	function makeTodo(
		title: string,
		date: string,
		completed: boolean,
	): HabitTrackerInput {
		return {
			title,
			startDate: dayjs.tz(date, TZ).toDate(),
			completed,
		};
	}

	it("같은 제목이 2주+ 연속이면 forming에 포함되어야 한다", () => {
		// Given — "운동"이 2주 연속
		const todos = [
			makeTodo("운동", "2026-03-16", true),
			makeTodo("운동", "2026-03-23", true),
		];

		// When
		const result = analyzeHabitFormation(todos, TZ);

		// Then
		expect(result.forming).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ title: "운동", weekCount: 2 }),
			]),
		);
	});

	it("1주만 등장한 항목은 분류하지 않아야 한다", () => {
		// Given
		const todos = [makeTodo("독서", "2026-03-16", true)];

		// When
		const result = analyzeHabitFormation(todos, TZ);

		// Then
		expect(result.forming).toHaveLength(0);
		expect(result.established).toHaveLength(0);
		expect(result.atRisk).toHaveLength(0);
	});

	it("빈 배열이면 모든 카테고리가 빈 배열이어야 한다", () => {
		// Given
		const todos: HabitTrackerInput[] = [];

		// When
		const result = analyzeHabitFormation(todos, TZ);

		// Then
		expect(result).toEqual({
			forming: [],
			established: [],
			atRisk: [],
		});
	});
});
