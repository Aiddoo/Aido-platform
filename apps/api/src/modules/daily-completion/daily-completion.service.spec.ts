import { Test, type TestingModule } from "@nestjs/testing";

import { DailyCompletionRepository } from "./daily-completion.repository";
import { DailyCompletionService } from "./daily-completion.service";

describe("DailyCompletionService", () => {
	let service: DailyCompletionService;
	let mockRepository: {
		aggregateTodosByDateRange: jest.Mock;
		findByDate: jest.Mock;
	};

	beforeEach(async () => {
		mockRepository = {
			aggregateTodosByDateRange: jest.fn(),
			findByDate: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DailyCompletionService,
				{
					provide: DailyCompletionRepository,
					useValue: mockRepository,
				},
			],
		}).compile();

		service = module.get<DailyCompletionService>(DailyCompletionService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("getDailyCompletionsRange", () => {
		const userId = "user-123";
		const startDate = "2026-01-01";
		const endDate = "2026-01-31";

		it("날짜 범위 내 완료 현황을 조회하여 반환한다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 3, completed: 3 },
				{ date: new Date("2026-01-16"), total: 2, completed: 1 },
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(2);
			expect(result.completions[0]).toEqual({
				date: "2026-01-15",
				totalTodos: 3,
				completedTodos: 3,
				isComplete: true,
				completionRate: 100,
			});
			expect(result.completions[1]).toEqual({
				date: "2026-01-16",
				totalTodos: 2,
				completedTodos: 1,
				isComplete: false,
				completionRate: 50,
			});
		});

		it("완료된 날의 총 개수를 정확히 계산한다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 3, completed: 3 }, // complete
				{ date: new Date("2026-01-16"), total: 2, completed: 1 }, // incomplete
				{ date: new Date("2026-01-17"), total: 1, completed: 1 }, // complete
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.totalCompleteDays).toBe(2);
		});

		it("날짜 범위를 올바르게 응답에 포함한다", async () => {
			// Given
			mockRepository.aggregateTodosByDateRange.mockResolvedValue([]);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.dateRange).toEqual({ startDate, endDate });
		});

		it("Repository에 올바른 파라미터로 호출한다", async () => {
			// Given
			mockRepository.aggregateTodosByDateRange.mockResolvedValue([]);

			// When
			await service.getDailyCompletionsRange({ userId, startDate, endDate });

			// Then
			expect(mockRepository.aggregateTodosByDateRange).toHaveBeenCalledWith({
				userId,
				startDate: expect.any(Date),
				endDate: expect.any(Date),
			});

			const callArgs =
				mockRepository.aggregateTodosByDateRange.mock.calls[0][0];

			// startDate와 endDate가 Date 객체인지 확인
			expect(callArgs.startDate).toBeInstanceOf(Date);
			expect(callArgs.endDate).toBeInstanceOf(Date);

			// endDate는 startDate보다 31일 후 (1월 전체 범위 + 1일)
			const daysDiff = Math.round(
				(callArgs.endDate.getTime() - callArgs.startDate.getTime()) /
					(1000 * 60 * 60 * 24),
			);
			expect(daysDiff).toBe(31);
		});

		it("Todo가 없는 경우 빈 배열과 0을 반환한다", async () => {
			// Given
			mockRepository.aggregateTodosByDateRange.mockResolvedValue([]);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toEqual([]);
			expect(result.totalCompleteDays).toBe(0);
		});

		it("결과를 날짜순으로 정렬하여 반환한다", async () => {
			// Given (순서가 뒤섞인 데이터)
			const aggregates = [
				{ date: new Date("2026-01-20"), total: 1, completed: 1 },
				{ date: new Date("2026-01-10"), total: 2, completed: 2 },
				{ date: new Date("2026-01-15"), total: 3, completed: 3 },
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(3);
			const [first, second, third] = result.completions;
			expect(first?.date).toBe("2026-01-10");
			expect(second?.date).toBe("2026-01-15");
			expect(third?.date).toBe("2026-01-20");
		});
	});

	describe("completionRate 계산", () => {
		const userId = "user-123";
		const startDate = "2026-01-01";
		const endDate = "2026-01-31";

		it("완료율을 퍼센트로 반올림하여 계산한다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 3, completed: 1 }, // 33.33% → 33%
				{ date: new Date("2026-01-16"), total: 3, completed: 2 }, // 66.66% → 67%
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(2);
			const [first, second] = result.completions;
			expect(first?.completionRate).toBe(33);
			expect(second?.completionRate).toBe(67);
		});

		it("0개 완료 시 완료율은 0%이다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 5, completed: 0 },
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.completionRate).toBe(0);
			expect(completion?.isComplete).toBe(false);
		});

		it("전체 완료 시 완료율은 100%이고 isComplete는 true이다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 5, completed: 5 },
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.completionRate).toBe(100);
			expect(completion?.isComplete).toBe(true);
		});
	});

	describe("isComplete 플래그", () => {
		const userId = "user-123";
		const startDate = "2026-01-01";
		const endDate = "2026-01-31";

		it("모든 Todo가 완료되면 isComplete는 true이다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 3, completed: 3 },
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.isComplete).toBe(true);
		});

		it("일부만 완료되면 isComplete는 false이다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 3, completed: 2 },
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.isComplete).toBe(false);
		});

		it("아무것도 완료하지 않으면 isComplete는 false이다", async () => {
			// Given
			const aggregates = [
				{ date: new Date("2026-01-15"), total: 3, completed: 0 },
			];
			mockRepository.aggregateTodosByDateRange.mockResolvedValue(aggregates);

			// When
			const result = await service.getDailyCompletionsRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.isComplete).toBe(false);
		});
	});
});
