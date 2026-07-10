/**
 * DailyCompletionRepository 리포지토리 단위 테스트
 *
 * @description
 * DailyCompletionRepository의 데이터 접근 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test daily-completion.repository
 * ```
 */
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";

import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { DailyCompletionRepository } from "./daily-completion.repository";

describe("DailyCompletionRepository — 일일 달성 리포지토리", () => {
	let repository: DailyCompletionRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		// 리포지토리는 CLS TransactionHost.tx에서 클라이언트를 읽으므로
		// tx가 Prisma mock을 반환하도록 스텁합니다.
		db = createMockPrisma();

		const { unit } = await TestBed.solitary(DailyCompletionRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: db }))
			.compile();

		repository = unit;
	});

	describe("aggregateTodosByDateRange", () => {
		const userId = "user-123";
		const startDate = new Date("2026-01-01");
		const endDate = new Date("2026-01-31");

		it("날짜 범위 내 Todo를 집계하여 반환한다", async () => {
			// Given - 전체/완료/카테고리 색상 집계 데이터 준비
			const totalAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 3 } },
				{ startDate: new Date("2026-01-16"), _count: { id: 2 } },
			];
			const completedAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 2 } },
				{ startDate: new Date("2026-01-16"), _count: { id: 2 } },
			];
			const categoryColorResults = [
				{ startDate: new Date("2026-01-15"), category: { color: "#FF6B43" } },
				{ startDate: new Date("2026-01-16"), category: { color: "#4A90D9" } },
			];

			(db.todo.groupBy as jest.Mock)
				.mockResolvedValueOnce(totalAggregations)
				.mockResolvedValueOnce(completedAggregations);
			(db.todo.findMany as jest.Mock).mockResolvedValueOnce(
				categoryColorResults,
			);

			// When - aggregateTodosByDateRange 호출
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then - 날짜별 집계 결과와 카테고리 색상이 포함되어야 한다
			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				date: new Date("2026-01-15"),
				total: 3,
				completed: 2,
				categoryColors: ["#FF6B43"],
			});
			expect(result[1]).toEqual({
				date: new Date("2026-01-16"),
				total: 2,
				completed: 2,
				categoryColors: ["#4A90D9"],
			});
		});

		it("전체 Todo, 완료 Todo, 카테고리 색상을 병렬로 조회한다", async () => {
			// Given - 빈 결과 준비
			(db.todo.groupBy as jest.Mock).mockResolvedValue([]);
			(db.todo.findMany as jest.Mock).mockResolvedValueOnce([]);

			// When - aggregateTodosByDateRange 호출
			await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then - groupBy 2회, findMany 1회 호출
			expect(db.todo.groupBy).toHaveBeenCalledTimes(2);
			expect(db.todo.findMany).toHaveBeenCalledTimes(1);

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

			// 세 번째 호출: 카테고리 색상
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: {
					userId,
					startDate: { gte: startDate, lt: endDate },
				},
				select: {
					startDate: true,
					category: { select: { color: true } },
				},
				distinct: ["startDate", "categoryId"],
			});
		});

		it("완료된 Todo가 없는 날짜는 completed를 0으로 반환한다", async () => {
			// Given - 완료 집계가 빈 배열인 데이터 준비
			const totalAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 3 } },
			];
			const completedAggregations: {
				startDate: Date;
				_count: { id: number };
			}[] = [];
			const categoryColorResults = [
				{ startDate: new Date("2026-01-15"), category: { color: "#FF6B43" } },
			];

			(db.todo.groupBy as jest.Mock)
				.mockResolvedValueOnce(totalAggregations)
				.mockResolvedValueOnce(completedAggregations);
			(db.todo.findMany as jest.Mock).mockResolvedValueOnce(
				categoryColorResults,
			);

			// When - aggregateTodosByDateRange 호출
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then - completed가 0이고 categoryColors가 포함되어야 한다
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				date: new Date("2026-01-15"),
				total: 3,
				completed: 0,
				categoryColors: ["#FF6B43"],
			});
		});

		it("Todo가 없으면 빈 배열을 반환한다", async () => {
			// Given - 모든 집계 결과가 빈 배열
			(db.todo.groupBy as jest.Mock).mockResolvedValue([]);
			(db.todo.findMany as jest.Mock).mockResolvedValueOnce([]);

			// When - aggregateTodosByDateRange 호출
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then - 빈 배열 반환
			expect(result).toEqual([]);
		});

		it("날짜별 카테고리 색상을 중복 제거하여 반환한다", async () => {
			// Given - 같은 날짜에 서로 다른 카테고리 색상
			const totalAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 3 } },
			];
			const completedAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 1 } },
			];
			const categoryColorResults = [
				{ startDate: new Date("2026-01-15"), category: { color: "#FF6B43" } },
				{ startDate: new Date("2026-01-15"), category: { color: "#4A90D9" } },
			];

			(db.todo.groupBy as jest.Mock)
				.mockResolvedValueOnce(totalAggregations)
				.mockResolvedValueOnce(completedAggregations);
			(db.todo.findMany as jest.Mock).mockResolvedValueOnce(
				categoryColorResults,
			);

			// When - aggregateTodosByDateRange 호출
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then - 두 색상이 모두 포함되어야 한다
			expect(result).toHaveLength(1);
			expect(result[0]?.categoryColors).toHaveLength(2);
			expect(result[0]?.categoryColors).toEqual(
				expect.arrayContaining(["#FF6B43", "#4A90D9"]),
			);
		});

		it("다른 카테고리지만 같은 색상은 하나로 합친다", async () => {
			// Given - 같은 날짜에 동일 색상의 다른 카테고리
			const totalAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 2 } },
			];
			const completedAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 1 } },
			];
			const categoryColorResults = [
				{ startDate: new Date("2026-01-15"), category: { color: "#FF6B43" } },
				{ startDate: new Date("2026-01-15"), category: { color: "#FF6B43" } },
			];

			(db.todo.groupBy as jest.Mock)
				.mockResolvedValueOnce(totalAggregations)
				.mockResolvedValueOnce(completedAggregations);
			(db.todo.findMany as jest.Mock).mockResolvedValueOnce(
				categoryColorResults,
			);

			// When - aggregateTodosByDateRange 호출
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then - Set 중복 제거로 하나의 색상만 포함
			expect(result).toHaveLength(1);
			expect(result[0]?.categoryColors).toEqual(["#FF6B43"]);
		});

		it("카테고리 색상 결과가 없는 날짜는 빈 배열을 반환한다", async () => {
			// Given - 집계 결과는 있지만 색상 결과가 없는 날짜
			const totalAggregations = [
				{ startDate: new Date("2026-01-15"), _count: { id: 1 } },
			];
			const completedAggregations: {
				startDate: Date;
				_count: { id: number };
			}[] = [];

			(db.todo.groupBy as jest.Mock)
				.mockResolvedValueOnce(totalAggregations)
				.mockResolvedValueOnce(completedAggregations);
			(db.todo.findMany as jest.Mock).mockResolvedValueOnce([]);

			// When - aggregateTodosByDateRange 호출
			const result = await repository.aggregateTodosByDateRange({
				userId,
				startDate,
				endDate,
			});

			// Then - categoryColors가 빈 배열이어야 한다
			expect(result).toHaveLength(1);
			expect(result[0]?.categoryColors).toEqual([]);
		});
	});

	describe("findByDate", () => {
		const userId = "user-123";
		const date = new Date("2026-01-15");

		it("특정 날짜의 Todo 집계 결과를 반환한다", async () => {
			// Given - 전체 3개, 완료 2개
			(db.todo.count as jest.Mock)
				.mockResolvedValueOnce(3) // totalCount
				.mockResolvedValueOnce(2); // completedCount

			// When - findByDate 호출
			const result = await repository.findByDate(userId, date);

			// Then - 집계 결과 반환
			expect(result).toEqual({
				date,
				total: 3,
				completed: 2,
			});
		});

		it("전체 개수와 완료 개수를 병렬로 조회한다", async () => {
			// Given - count mock
			(db.todo.count as jest.Mock).mockResolvedValue(0);

			// When - findByDate 호출
			await repository.findByDate(userId, date);

			// Then - count 2회 호출
			expect(db.todo.count).toHaveBeenCalledTimes(2);
		});

		it("해당 날짜의 Todo가 없으면 null을 반환한다", async () => {
			// Given - totalCount 0
			(db.todo.count as jest.Mock).mockResolvedValue(0);

			// When - findByDate 호출
			const result = await repository.findByDate(userId, date);

			// Then - null 반환
			expect(result).toBeNull();
		});

		it("날짜 범위를 올바르게 설정한다 (해당 날짜의 시작부터 다음 날 시작까지)", async () => {
			// Given - 날짜 범위 검증용
			const expectedStartOfDay = new Date("2026-01-15T00:00:00.000Z");
			const expectedEndOfDay = new Date("2026-01-16T00:00:00.000Z");
			(db.todo.count as jest.Mock).mockResolvedValue(1);

			// When - findByDate 호출
			await repository.findByDate(userId, date);

			// Then - 날짜 범위가 올바르게 설정되어야 한다
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
