import { mapToCompletionSummaries } from "./daily-completion.mapper";
import type { TodoAggregateByDate } from "./types/daily-completion.types";

describe("DailyCompletion Mapper", () => {
	const createMockAggregate = (
		overrides: Partial<TodoAggregateByDate> = {},
	): TodoAggregateByDate => ({
		date: new Date("2024-01-15T00:00:00.000Z"),
		total: 5,
		completed: 3,
		...overrides,
	});

	describe("mapToCompletionSummaries", () => {
		it("단일 집계 데이터를 완료 요약으로 변환한다", () => {
			const aggregates = [createMockAggregate()];

			const result = mapToCompletionSummaries(aggregates);

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
			const aggregates = [
				createMockAggregate({
					date: new Date("2024-01-17T00:00:00.000Z"),
					total: 2,
					completed: 1,
				}),
				createMockAggregate({
					date: new Date("2024-01-15T00:00:00.000Z"),
					total: 3,
					completed: 3,
				}),
				createMockAggregate({
					date: new Date("2024-01-16T00:00:00.000Z"),
					total: 4,
					completed: 2,
				}),
			];

			const result = mapToCompletionSummaries(aggregates);

			expect(result).toHaveLength(3);
			expect(result[0]?.date).toBe("2024-01-15");
			expect(result[1]?.date).toBe("2024-01-16");
			expect(result[2]?.date).toBe("2024-01-17");
		});

		it("완료율을 퍼센트로 반올림하여 계산한다", () => {
			const aggregates = [
				createMockAggregate({ total: 3, completed: 1 }), // 33.33... -> 33%
			];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.completionRate).toBe(33);
		});

		it("완료율 반올림 경계값을 올바르게 처리한다", () => {
			const aggregates = [
				createMockAggregate({ total: 3, completed: 2 }), // 66.66... -> 67%
			];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.completionRate).toBe(67);
		});

		it("전체 완료 시 isComplete를 true로 설정한다", () => {
			const aggregates = [createMockAggregate({ total: 5, completed: 5 })];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.isComplete).toBe(true);
			expect(result[0]?.completionRate).toBe(100);
		});

		it("일부만 완료 시 isComplete를 false로 설정한다", () => {
			const aggregates = [createMockAggregate({ total: 5, completed: 4 })];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.isComplete).toBe(false);
		});

		it("0개 완료 시 isComplete를 false로 설정한다", () => {
			const aggregates = [createMockAggregate({ total: 5, completed: 0 })];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.isComplete).toBe(false);
			expect(result[0]?.completionRate).toBe(0);
		});

		it("total이 0인 경우 isComplete를 false로, completionRate를 0으로 설정한다", () => {
			const aggregates = [createMockAggregate({ total: 0, completed: 0 })];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.isComplete).toBe(false);
			expect(result[0]?.completionRate).toBe(0);
		});

		it("빈 배열을 입력하면 빈 배열을 반환한다", () => {
			const result = mapToCompletionSummaries([]);

			expect(result).toEqual([]);
		});

		it("날짜를 YYYY-MM-DD 형식으로 변환한다", () => {
			const aggregates = [
				createMockAggregate({
					date: new Date("2024-12-25T15:30:45.000Z"),
				}),
			];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.date).toBe("2024-12-25");
		});

		it("UTC 날짜를 올바르게 처리한다", () => {
			const aggregates = [
				createMockAggregate({
					date: new Date("2024-01-01T23:59:59.999Z"),
				}),
			];

			const result = mapToCompletionSummaries(aggregates);

			expect(result[0]?.date).toBe("2024-01-01");
		});
	});
});
