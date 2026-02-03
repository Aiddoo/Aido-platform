import { DailyCompletionMapper } from "./daily-completion.mapper";
import type { TodoAggregateByDate } from "./types/daily-completion.types";

describe("DailyCompletionMapper", () => {
	/**
	 * TodoAggregateByDate 빌더 헬퍼
	 * daily-completion은 전용 Builder가 없으므로 로컬 헬퍼 사용
	 */
	const createAggregate = (
		overrides: Partial<TodoAggregateByDate> = {},
	): TodoAggregateByDate => ({
		date: new Date("2024-01-15T00:00:00.000Z"),
		total: 5,
		completed: 3,
		...overrides,
	});

	describe("toCompletionSummaries", () => {
		it("단일 집계 데이터를 완료 요약으로 변환한다", () => {
			// Given - 단일 집계 데이터 준비
			const aggregates = [createAggregate()];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - 완료 요약으로 올바르게 변환되었는지 검증
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				date: "2024-01-15",
				totalTodos: 5,
				completedTodos: 3,
				isComplete: false,
				completionRate: 60,
			});
		});

		it("여러 집계 데이터를 날짜순으로 정렬하여 변환한다", () => {
			// Given - 정렬되지 않은 여러 집계 데이터 준비
			const aggregates = [
				createAggregate({
					date: new Date("2024-01-17T00:00:00.000Z"),
					total: 2,
					completed: 1,
				}),
				createAggregate({
					date: new Date("2024-01-15T00:00:00.000Z"),
					total: 3,
					completed: 3,
				}),
				createAggregate({
					date: new Date("2024-01-16T00:00:00.000Z"),
					total: 4,
					completed: 2,
				}),
			];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - 날짜순으로 정렬되어 변환되었는지 검증
			expect(result).toHaveLength(3);
			expect(result[0]?.date).toBe("2024-01-15");
			expect(result[1]?.date).toBe("2024-01-16");
			expect(result[2]?.date).toBe("2024-01-17");
		});

		it("완료율을 퍼센트로 반올림하여 계산한다", () => {
			// Given - 33.33...%가 나오는 집계 데이터 준비
			const aggregates = [createAggregate({ total: 3, completed: 1 })];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - 33%로 반올림되었는지 검증
			expect(result[0]?.completionRate).toBe(33);
		});

		it("완료율 반올림 경계값을 올바르게 처리한다", () => {
			// Given - 66.66...%가 나오는 집계 데이터 준비
			const aggregates = [createAggregate({ total: 3, completed: 2 })];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - 67%로 반올림되었는지 검증
			expect(result[0]?.completionRate).toBe(67);
		});

		it("전체 완료 시 isComplete를 true로 설정한다", () => {
			// Given - 전체 완료된 집계 데이터 준비
			const aggregates = [createAggregate({ total: 5, completed: 5 })];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - isComplete가 true이고 completionRate가 100인지 검증
			expect(result[0]?.isComplete).toBe(true);
			expect(result[0]?.completionRate).toBe(100);
		});

		it("일부만 완료 시 isComplete를 false로 설정한다", () => {
			// Given - 일부만 완료된 집계 데이터 준비
			const aggregates = [createAggregate({ total: 5, completed: 4 })];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - isComplete가 false인지 검증
			expect(result[0]?.isComplete).toBe(false);
		});

		it("0개 완료 시 isComplete를 false로 설정한다", () => {
			// Given - 하나도 완료되지 않은 집계 데이터 준비
			const aggregates = [createAggregate({ total: 5, completed: 0 })];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - isComplete가 false이고 completionRate가 0인지 검증
			expect(result[0]?.isComplete).toBe(false);
			expect(result[0]?.completionRate).toBe(0);
		});

		it("total이 0인 경우 isComplete를 false로, completionRate를 0으로 설정한다", () => {
			// Given - total이 0인 집계 데이터 준비 (0 나누기 방지 케이스)
			const aggregates = [createAggregate({ total: 0, completed: 0 })];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - isComplete가 false이고 completionRate가 0인지 검증
			expect(result[0]?.isComplete).toBe(false);
			expect(result[0]?.completionRate).toBe(0);
		});

		it("빈 배열을 입력하면 빈 배열을 반환한다", () => {
			// Given - 빈 배열 준비

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries([]);

			// Then - 빈 배열이 반환되는지 검증
			expect(result).toEqual([]);
		});

		it("날짜를 YYYY-MM-DD 형식으로 변환한다", () => {
			// Given - 시간 정보가 포함된 날짜를 가진 집계 데이터 준비
			const aggregates = [
				createAggregate({
					date: new Date("2024-12-25T15:30:45.000Z"),
				}),
			];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - YYYY-MM-DD 형식으로 변환되었는지 검증
			expect(result[0]?.date).toBe("2024-12-25");
		});

		it("UTC 날짜를 올바르게 처리한다", () => {
			// Given - UTC 경계 시간을 가진 집계 데이터 준비
			const aggregates = [
				createAggregate({
					date: new Date("2024-01-01T23:59:59.999Z"),
				}),
			];

			// When - Mapper 호출
			const result = DailyCompletionMapper.toCompletionSummaries(aggregates);

			// Then - UTC 날짜가 올바르게 변환되었는지 검증
			expect(result[0]?.date).toBe("2024-01-01");
		});
	});
});
