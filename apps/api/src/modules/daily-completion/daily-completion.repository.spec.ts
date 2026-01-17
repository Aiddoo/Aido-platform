import { Test, type TestingModule } from "@nestjs/testing";

import { DatabaseService } from "@/database";

import { DailyCompletionRepository } from "./daily-completion.repository";

describe("DailyCompletionRepository", () => {
	let repository: DailyCompletionRepository;
	let mockDatabase: {
		todo: {
			groupBy: jest.Mock;
			count: jest.Mock;
		};
	};

	beforeEach(async () => {
		mockDatabase = {
			todo: {
				groupBy: jest.fn(),
				count: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DailyCompletionRepository,
				{
					provide: DatabaseService,
					useValue: mockDatabase,
				},
			],
		}).compile();

		repository = module.get<DailyCompletionRepository>(
			DailyCompletionRepository,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("aggregateTodosByDateRange", () => {
		const userId = "user-123";
		const startDate = new Date("2026-01-01");
		const endDate = new Date("2026-01-31");

		it("날짜 범위 내 Todo를 집계하여 반환한다", async () => {
			// Given
			const totalAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 3 } },
				{ startDate: new Date("2026-01-16"), _count: { id: 2 } },
			];
			const completedAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 2 } },
				{ startDate: new Date("2026-01-16"), _count: { id: 2 } },
			];

			mockDatabase.todo.groupBy
				.mockResolvedValueOnce(totalAggregations)
				.mockResolvedValueOnce(completedAggregations);

			// When
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				date: new Date("2026-01-15"),
				total: 3,
				completed: 2,
			});
			expect(result[1]).toEqual({
				date: new Date("2026-01-16"),
				total: 2,
				completed: 2,
			});
		});

		it("전체 Todo와 완료 Todo를 병렬로 조회한다", async () => {
			// Given
			mockDatabase.todo.groupBy.mockResolvedValue([]);

			// When
			await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(mockDatabase.todo.groupBy).toHaveBeenCalledTimes(2);

			// 첫 번째 호출: 전체 Todo
			expect(mockDatabase.todo.groupBy).toHaveBeenNthCalledWith(1, {
				by: ["startDate"],
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
				},
				_count: { id: true },
			});

			// 두 번째 호출: 완료 Todo
			expect(mockDatabase.todo.groupBy).toHaveBeenNthCalledWith(2, {
				by: ["startDate"],
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
					completed: true,
				},
				_count: { id: true },
			});
		});

		it("완료된 Todo가 없는 날짜는 completed를 0으로 반환한다", async () => {
			// Given
			const totalAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 3 } },
			];
			const completedAggregations: {
				startDate: Date;
				_count: { id: number };
			}[] = [];

			mockDatabase.todo.groupBy
				.mockResolvedValueOnce(totalAggregations)
				.mockResolvedValueOnce(completedAggregations);

			// When
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				date: new Date("2026-01-15"),
				total: 3,
				completed: 0,
			});
		});

		it("Todo가 없으면 빈 배열을 반환한다", async () => {
			// Given
			mockDatabase.todo.groupBy.mockResolvedValue([]);

			// When
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(result).toEqual([]);
		});
	});

	describe("findByDate", () => {
		const userId = "user-123";
		const date = new Date("2026-01-15");

		it("특정 날짜의 Todo 집계 결과를 반환한다", async () => {
			// Given
			mockDatabase.todo.count
				.mockResolvedValueOnce(3) // totalCount
				.mockResolvedValueOnce(2); // completedCount

			// When
			const result = await repository.findByDate(userId, date);

			// Then
			expect(result).toEqual({
				date,
				total: 3,
				completed: 2,
			});
		});

		it("전체 개수와 완료 개수를 병렬로 조회한다", async () => {
			// Given
			mockDatabase.todo.count.mockResolvedValue(0);

			// When
			await repository.findByDate(userId, date);

			// Then
			expect(mockDatabase.todo.count).toHaveBeenCalledTimes(2);
		});

		it("해당 날짜의 Todo가 없으면 null을 반환한다", async () => {
			// Given
			mockDatabase.todo.count.mockResolvedValue(0);

			// When
			const result = await repository.findByDate(userId, date);

			// Then
			expect(result).toBeNull();
		});

		it("날짜 범위를 올바르게 설정한다 (해당 날짜의 시작부터 다음 날 시작까지)", async () => {
			// Given
			const expectedStartOfDay = new Date("2026-01-15T00:00:00.000Z");
			const expectedEndOfDay = new Date("2026-01-16T00:00:00.000Z");
			mockDatabase.todo.count.mockResolvedValue(1);

			// When
			await repository.findByDate(userId, date);

			// Then
			expect(mockDatabase.todo.count).toHaveBeenCalledWith({
				where: {
					userId,
					startDate: {
						gte: expectedStartOfDay,
						lt: expectedEndOfDay,
					},
				},
			});
		});
	});
});
