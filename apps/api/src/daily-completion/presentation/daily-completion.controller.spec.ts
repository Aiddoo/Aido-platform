/**
 * DailyCompletionController 단위 테스트
 *
 * 컨트롤러는 DailyCompletionFacade에만 위임한다. 인자 전달과 응답 매핑을 검증한다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";

import { DailyCompletionFacade } from "../application/facades/daily-completion.facade";
import type { DailyCompletionsRange } from "../domain/daily-completion";
import { DailyCompletionController } from "./daily-completion.controller";
import type { GetDailyCompletionsRangeDto } from "./dtos";

function makeQuery(
	overrides: Partial<GetDailyCompletionsRangeDto> = {},
): GetDailyCompletionsRangeDto {
	return { startDate: "2026-01-01", endDate: "2026-01-31", ...overrides };
}

describe("DailyCompletionController — 일일 달성 컨트롤러", () => {
	let controller: DailyCompletionController;
	let mockFacade: Mocked<DailyCompletionFacade>;

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
		mockFacade = unitRef.get(DailyCompletionFacade);
	});

	describe("getDailyCompletionsRange", () => {
		it("조회 요청을 Facade에 위임하고 매핑된 결과를 반환해야 한다", async () => {
			// Given - 조회 쿼리와 Facade 응답이 준비되었을 때
			const query = makeQuery();
			const facadeResult: DailyCompletionsRange = {
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
				dateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
			};
			mockFacade.getDailyCompletions.mockResolvedValue(facadeResult);

			// When - getDailyCompletionsRange를 호출하면
			const result = await controller.getDailyCompletionsRange(mockUser, query);

			// Then - userId/startDate/endDate를 전달하고 매핑된 결과를 반환해야 한다
			expect(mockFacade.getDailyCompletions).toHaveBeenCalledWith(
				mockUser.userId,
				query.startDate,
				query.endDate,
			);
			expect(result).toEqual(facadeResult);
		});

		it("완료 현황이 없을 때 빈 배열을 반환해야 한다", async () => {
			// Given - 해당 기간에 할 일이 없을 때
			const query = makeQuery({
				startDate: "2026-02-01",
				endDate: "2026-02-28",
			});
			const facadeResult: DailyCompletionsRange = {
				completions: [],
				totalCompleteDays: 0,
				dateRange: { startDate: "2026-02-01", endDate: "2026-02-28" },
			};
			mockFacade.getDailyCompletions.mockResolvedValue(facadeResult);

			// When - getDailyCompletionsRange를 호출하면
			const result = await controller.getDailyCompletionsRange(mockUser, query);

			// Then - 빈 completions와 totalCompleteDays 0을 반환해야 한다
			expect(result).toEqual(facadeResult);
		});
	});
});
