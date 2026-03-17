/**
 * DailyCompletionService 단위 테스트
 *
 * Suites + Builder 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: 테스트 데이터 생성
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DailyCompletionRepository } from "./daily-completion.repository";
import { DailyCompletionService } from "./daily-completion.service";

describe("DailyCompletionService", () => {
	let service: DailyCompletionService;
	let dailyCompletionRepo: Mocked<DailyCompletionRepository>;

	// 테스트 데이터
	const mockUserId = "user-123";
	const startDate = "2026-01-01";
	const endDate = "2026-01-31";

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			DailyCompletionService,
		).compile();

		service = unit;
		dailyCompletionRepo = unitRef.get(DailyCompletionRepository);
	});

	// ============================================
	// getDailyCompletionsRange
	// ============================================

	describe("getDailyCompletionsRange", () => {
		it("날짜 범위 내 완료 현황을 조회하여 반환한다", async () => {
			// Given - 날짜별 집계 데이터 준비
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 3,
					categoryColors: ["#FF6B43"],
				},
				{
					date: new Date("2026-01-16"),
					total: 2,
					completed: 1,
					categoryColors: ["#4A90D9"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 완료 현황과 카테고리 색상이 포함되어야 한다
			expect(result.completions).toHaveLength(2);
			expect(result.completions[0]).toEqual({
				date: "2026-01-15",
				totalTodos: 3,
				completedTodos: 3,
				isComplete: true,
				completionRate: 100,
				categoryColors: ["#FF6B43"],
			});
			expect(result.completions[1]).toEqual({
				date: "2026-01-16",
				totalTodos: 2,
				completedTodos: 1,
				isComplete: false,
				completionRate: 50,
				categoryColors: ["#4A90D9"],
			});
		});

		it("완료된 날의 총 개수를 정확히 계산한다", async () => {
			// Given - 완료/미완료 혼합 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 3,
					categoryColors: ["#FF6B43"],
				},
				{
					date: new Date("2026-01-16"),
					total: 2,
					completed: 1,
					categoryColors: ["#4A90D9"],
				},
				{
					date: new Date("2026-01-17"),
					total: 1,
					completed: 1,
					categoryColors: ["#FF6B43"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 완료된 날이 2일이어야 한다
			expect(result.totalCompleteDays).toBe(2);
		});

		it("날짜 범위를 올바르게 응답에 포함한다", async () => {
			// Given - 빈 결과
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue([]);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 요청한 날짜 범위가 응답에 포함되어야 한다
			expect(result.dateRange).toEqual({ startDate, endDate });
		});

		it("Repository에 올바른 파라미터로 호출한다", async () => {
			// Given - 빈 결과
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue([]);

			// When - getDailyCompletionsRange 호출
			await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - Date 객체로 변환하여 Repository에 전달해야 한다
			expect(
				dailyCompletionRepo.aggregateTodosByDateRange,
			).toHaveBeenCalledWith({
				userId: mockUserId,
				startDate: expect.any(Date),
				endDate: expect.any(Date),
			});

			const callArgs =
				dailyCompletionRepo.aggregateTodosByDateRange.mock.calls[0]?.[0];

			// startDate와 endDate가 Date 객체인지 확인
			expect(callArgs?.startDate).toBeInstanceOf(Date);
			expect(callArgs?.endDate).toBeInstanceOf(Date);

			// endDate는 startDate보다 31일 후 (1월 전체 범위 + 1일)
			const daysDiff = Math.round(
				((callArgs?.endDate?.getTime() ?? 0) -
					(callArgs?.startDate?.getTime() ?? 0)) /
					(1000 * 60 * 60 * 24),
			);
			expect(daysDiff).toBe(31);
		});

		it("Todo가 없는 경우 빈 배열과 0을 반환한다", async () => {
			// Given - 빈 결과
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue([]);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 빈 completions와 totalCompleteDays 0
			expect(result.completions).toEqual([]);
			expect(result.totalCompleteDays).toBe(0);
		});

		it("결과를 날짜순으로 정렬하여 반환한다", async () => {
			// Given - 순서가 뒤섞인 데이터
			const aggregates = [
				{
					date: new Date("2026-01-20"),
					total: 1,
					completed: 1,
					categoryColors: ["#FF6B43"],
				},
				{
					date: new Date("2026-01-10"),
					total: 2,
					completed: 2,
					categoryColors: ["#4A90D9"],
				},
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 3,
					categoryColors: ["#7ED321"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 날짜순으로 정렬되어야 한다
			expect(result.completions).toHaveLength(3);
			const [first, second, third] = result.completions;
			expect(first?.date).toBe("2026-01-10");
			expect(second?.date).toBe("2026-01-15");
			expect(third?.date).toBe("2026-01-20");
		});

		it("날짜별 카테고리 색상을 응답에 포함한다", async () => {
			// Given - 다양한 카테고리 색상을 가진 집계 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 2,
					categoryColors: ["#FF6B43", "#4A90D9"],
				},
				{
					date: new Date("2026-01-16"),
					total: 1,
					completed: 0,
					categoryColors: ["#7ED321"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 각 날짜의 카테고리 색상이 포함되어야 한다
			expect(result.completions[0]?.categoryColors).toEqual([
				"#FF6B43",
				"#4A90D9",
			]);
			expect(result.completions[1]?.categoryColors).toEqual(["#7ED321"]);
		});
	});

	// ============================================
	// completionRate 계산
	// ============================================

	describe("completionRate 계산", () => {
		it("완료율을 퍼센트로 반올림하여 계산한다", async () => {
			// Given - 33%, 67% 완료율 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 1,
					categoryColors: ["#FF6B43"],
				},
				{
					date: new Date("2026-01-16"),
					total: 3,
					completed: 2,
					categoryColors: ["#FF6B43"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - 반올림 완료율 검증
			expect(result.completions).toHaveLength(2);
			const [first, second] = result.completions;
			expect(first?.completionRate).toBe(33);
			expect(second?.completionRate).toBe(67);
		});

		it("0개 완료 시 완료율은 0%이다", async () => {
			// Given - 0개 완료 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 5,
					completed: 0,
					categoryColors: ["#FF6B43"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - completionRate 0, isComplete false
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.completionRate).toBe(0);
			expect(completion?.isComplete).toBe(false);
		});

		it("전체 완료 시 완료율은 100%이고 isComplete는 true이다", async () => {
			// Given - 전체 완료 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 5,
					completed: 5,
					categoryColors: ["#FF6B43"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - completionRate 100, isComplete true
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.completionRate).toBe(100);
			expect(completion?.isComplete).toBe(true);
		});
	});

	// ============================================
	// isComplete 플래그
	// ============================================

	describe("isComplete 플래그", () => {
		it("모든 Todo가 완료되면 isComplete는 true이다", async () => {
			// Given - 전체 완료 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 3,
					categoryColors: ["#FF6B43"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - isComplete true
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.isComplete).toBe(true);
		});

		it("일부만 완료되면 isComplete는 false이다", async () => {
			// Given - 일부 완료 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 2,
					categoryColors: ["#FF6B43"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - isComplete false
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.isComplete).toBe(false);
		});

		it("아무것도 완료하지 않으면 isComplete는 false이다", async () => {
			// Given - 미완료 데이터
			const aggregates = [
				{
					date: new Date("2026-01-15"),
					total: 3,
					completed: 0,
					categoryColors: ["#FF6B43"],
				},
			];
			dailyCompletionRepo.aggregateTodosByDateRange.mockResolvedValue(
				aggregates,
			);

			// When - getDailyCompletionsRange 호출
			const result = await service.getDailyCompletionsRange({
				userId: mockUserId,
				startDate,
				endDate,
			});

			// Then - isComplete false
			expect(result.completions).toHaveLength(1);
			const [completion] = result.completions;
			expect(completion?.isComplete).toBe(false);
		});
	});
});
