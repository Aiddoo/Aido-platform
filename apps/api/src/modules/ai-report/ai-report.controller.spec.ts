/**
 * AiReportController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조 명확화
 */

import type { AiReport as AiReportDto, ReportStatus } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import { AiReportController } from "./ai-report.controller";
import { AiReportService } from "./ai-report.service";

describe("AiReportController", () => {
	let controller: AiReportController;
	let mockService: Mocked<AiReportService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(AiReportController).compile();

		controller = unit;
		mockService = unitRef.get(AiReportService);
	});

	// =========================================================================
	// getStatus
	// =========================================================================

	describe("getStatus", () => {
		it("리포트 상태 조회를 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -서비스에서 리포트 상태를 반환하도록 설정
			const tz = "Asia/Seoul";
			const mockStatus: ReportStatus = {
				nextWeeklyAt: "2026-03-09T00:00:00.000Z",
				nextMonthlyAt: "2026-04-01T00:00:00.000Z",
				daysUntilWeekly: 6,
				daysUntilMonthly: 29,
				latestWeekly: null,
				latestMonthly: null,
			};
			mockService.getReportStatus.mockResolvedValue(mockStatus);

			// When -getStatus를 호출하면
			const result = await controller.getStatus(mockUser, tz);

			// Then -서비스에 올바른 파라미터를 전달하고 응답을 반환해야 한다
			expect(mockService.getReportStatus).toHaveBeenCalledWith(
				mockUser.userId,
				tz,
			);
			expect(result).toEqual({ status: mockStatus });
		});
	});

	// =========================================================================
	// getReports
	// =========================================================================

	describe("getReports", () => {
		it("리포트 목록 조회를 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -서비스에서 빈 리포트 목록을 반환하도록 설정
			const query = { type: "WEEKLY" as const, limit: 10 };
			const mockReports: AiReportDto[] = [];
			mockService.getReports.mockResolvedValue(mockReports);

			// When -getReports를 호출하면
			const result = await controller.getReports(mockUser, query as never);

			// Then -서비스에 올바른 파라미터를 전달하고 응답을 반환해야 한다
			expect(mockService.getReports).toHaveBeenCalledWith(mockUser.userId, {
				type: "WEEKLY",
				limit: 10,
			});
			expect(result).toEqual({ reports: mockReports });
		});

		it("타입 필터 없이 전체 리포트를 조회할 수 있어야 한다", async () => {
			// Given -타입 필터 없는 쿼리
			const query = { limit: 10 };
			const mockReports: AiReportDto[] = [];
			mockService.getReports.mockResolvedValue(mockReports);

			// When -getReports를 호출하면
			const result = await controller.getReports(mockUser, query as never);

			// Then -type이 undefined로 전달되어야 한다
			expect(mockService.getReports).toHaveBeenCalledWith(mockUser.userId, {
				type: undefined,
				limit: 10,
			});
			expect(result).toEqual({ reports: mockReports });
		});
	});

	// =========================================================================
	// getReport
	// =========================================================================

	describe("getReport", () => {
		it("리포트 상세 조회를 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -서비스에서 리포트를 반환하도록 설정
			const reportId = 42;
			const mockReport: AiReportDto = {
				id: 42,
				type: "WEEKLY",
				year: 2026,
				period: 10,
				periodLabel: "2026년 10주차",
				dateRange: {
					startDate: "2026-03-02",
					endDate: "2026-03-08",
				},
				stats: {
					totalTodos: 10,
					completedTodos: 8,
					completionRate: 80,
					prevCompletionRate: 70,
					streakDays: 3,
				},
				categoryBreakdown: [],
				dayPatterns: [],
				timePatterns: [],
				aiSummary: "좋은 한 주였어!",
				aiTips: ["계속 이렇게 해봐!"],
				hasActivity: true,
				generatedAt: "2026-03-09T07:00:00.000Z",
			};
			mockService.getReportById.mockResolvedValue(mockReport);

			// When -getReport를 호출하면
			const result = await controller.getReport(mockUser, reportId);

			// Then -서비스에 올바른 파라미터를 전달하고 응답을 반환해야 한다
			expect(mockService.getReportById).toHaveBeenCalledWith(
				mockUser.userId,
				reportId,
			);
			expect(result).toEqual({ report: mockReport });
		});
	});
});
