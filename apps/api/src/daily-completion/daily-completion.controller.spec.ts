/**
 * DailyCompletionController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";

import { DailyCompletionController } from "./daily-completion.controller";
import { DailyCompletionService } from "./daily-completion.service";
import type { GetDailyCompletionsRangeDto } from "./dtos";
import type { DailyCompletionsRangeResult } from "./types/daily-completion.types";

describe("DailyCompletionController — 일일 달성 컨트롤러", () => {
	let controller: DailyCompletionController;
	let mockDailyCompletionService: Mocked<DailyCompletionService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			DailyCompletionController,
		).compile();

		controller = unit;
		mockDailyCompletionService = unitRef.get(DailyCompletionService);
	});

	describe("getDailyCompletionsRange", () => {
		it("날짜 범위 내 일일 완료 현황 조회를 서비스에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given - 조회 쿼리와 서비스 응답이 준비되었을 때
			const query = {
				startDate: "2026-01-01",
				endDate: "2026-01-31",
			} as unknown as GetDailyCompletionsRangeDto;
			const serviceResult: DailyCompletionsRangeResult = {
				completions: [
					{
						date: "2026-01-15",
						totalTodos: 3,
						completedTodos: 3,
						isComplete: true,
						completionRate: 100,
						categoryColors: ["#FF6B43", "#4A90D9"],
					},
					{
						date: "2026-01-16",
						totalTodos: 4,
						completedTodos: 2,
						isComplete: false,
						completionRate: 50,
						categoryColors: ["#FF6B43"],
					},
				],
				totalCompleteDays: 1,
				dateRange: {
					startDate: "2026-01-01",
					endDate: "2026-01-31",
				},
			};
			mockDailyCompletionService.getDailyCompletionsRange.mockResolvedValue(
				serviceResult,
			);

			// When - getDailyCompletionsRange를 호출하면
			const result = await controller.getDailyCompletionsRange(mockUser, query);

			// Then - 서비스에 userId, startDate, endDate를 전달하고 매핑된 결과를 반환해야 한다
			expect(
				mockDailyCompletionService.getDailyCompletionsRange,
			).toHaveBeenCalledWith({
				userId: mockUser.userId,
				startDate: query.startDate,
				endDate: query.endDate,
			});
			expect(result).toEqual({
				completions: [
					{
						date: "2026-01-15",
						totalTodos: 3,
						completedTodos: 3,
						isComplete: true,
						completionRate: 100,
						categoryColors: ["#FF6B43", "#4A90D9"],
					},
					{
						date: "2026-01-16",
						totalTodos: 4,
						completedTodos: 2,
						isComplete: false,
						completionRate: 50,
						categoryColors: ["#FF6B43"],
					},
				],
				totalCompleteDays: 1,
				dateRange: {
					startDate: "2026-01-01",
					endDate: "2026-01-31",
				},
			});
		});

		it("완료 현황이 없을 때 빈 배열을 반환해야 한다", async () => {
			// Given - 해당 기간에 할 일이 없을 때
			const query = {
				startDate: "2026-02-01",
				endDate: "2026-02-28",
			} as unknown as GetDailyCompletionsRangeDto;
			const serviceResult: DailyCompletionsRangeResult = {
				completions: [],
				totalCompleteDays: 0,
				dateRange: {
					startDate: "2026-02-01",
					endDate: "2026-02-28",
				},
			};
			mockDailyCompletionService.getDailyCompletionsRange.mockResolvedValue(
				serviceResult,
			);

			// When - getDailyCompletionsRange를 호출하면
			const result = await controller.getDailyCompletionsRange(mockUser, query);

			// Then - 빈 completions 배열과 totalCompleteDays 0을 반환해야 한다
			expect(result).toEqual({
				completions: [],
				totalCompleteDays: 0,
				dateRange: {
					startDate: "2026-02-01",
					endDate: "2026-02-28",
				},
			});
		});
	});
});
