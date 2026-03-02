import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database";

import { DailyCompletionRepository } from "./daily-completion.repository";

describe("DailyCompletionRepository", () => {
	let repository: DailyCompletionRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			DailyCompletionRepository,
		).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
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

			(db.todo.groupBy as jest.Mock)
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
			(db.todo.groupBy as jest.Mock).mockResolvedValue([]);

			// When
			await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then
			expect(db.todo.groupBy).toHaveBeenCalledTimes(2);

			// 첫 번째 호출: 전체 Todo
			expect(db.todo.groupBy).toHaveBeenNthCalledWith(1, {
				by: ["startDate"],
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
				},
				_count: { id: true },
			});

			// 두 번째 호출: 완료 Todo
			expect(db.todo.groupBy).toHaveBeenNthCalledWith(2, {
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

			(db.todo.groupBy as jest.Mock)
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
			(db.todo.groupBy as jest.Mock).mockResolvedValue([]);

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
			(db.todo.count as jest.Mock)
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
			(db.todo.count as jest.Mock).mockResolvedValue(0);

			// When
			await repository.findByDate(userId, date);

			// Then
			expect(db.todo.count).toHaveBeenCalledTimes(2);
		});

		it("해당 날짜의 Todo가 없으면 null을 반환한다", async () => {
			// Given
			(db.todo.count as jest.Mock).mockResolvedValue(0);

			// When
			const result = await repository.findByDate(userId, date);

			// Then
			expect(result).toBeNull();
		});

		it("날짜 범위를 올바르게 설정한다 (해당 날짜의 시작부터 다음 날 시작까지)", async () => {
			// Given
			const expectedStartOfDay = new Date("2026-01-15T00:00:00.000Z");
			const expectedEndOfDay = new Date("2026-01-16T00:00:00.000Z");
			(db.todo.count as jest.Mock).mockResolvedValue(1);

			// When
			await repository.findByDate(userId, date);

			// Then
			expect(db.todo.count).toHaveBeenCalledWith({
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
