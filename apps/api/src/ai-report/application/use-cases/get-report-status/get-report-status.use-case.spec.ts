/**
 * GetReportStatusUseCase 단위 테스트
 *
 * - 프리미엄 게이트 우선 검증
 * - daysUntil은 캘린더(날짜) 기준 계산
 * - 최신 리포트 반환
 */

import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { AiReport } from "../../../domain/entities/ai-report.entity";
import type { ReportType } from "../../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { ReportAccessService } from "../../services/report-access.service";
import { GetReportStatusUseCase } from "./get-report-status.use-case";

const makeReport = (type: ReportType): AiReport =>
	AiReport.reconstitute({
		id: 1,
		userId: "user-123",
		type,
		year: 2026,
		period: 10,
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
		aiSummary: "요약",
		aiTips: [],
		locale: "ko",
		hasActivity: true,
		generatedAt: new Date("2026-03-09T07:00:00.000Z"),
	});

describe("GetReportStatusUseCase", () => {
	let useCase: GetReportStatusUseCase;
	let mockRepository: Mocked<AiReportRepositoryPort>;
	let mockAccess: Mocked<ReportAccessService>;

	const tz = "Asia/Seoul";

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			GetReportStatusUseCase,
		).compile();
		useCase = unit;
		mockRepository = unitRef.get(AI_REPORT_REPOSITORY);
		mockAccess = unitRef.get(ReportAccessService);
		mockRepository.findLatest.mockResolvedValue(null);
	});

	it("비프리미엄이면 조회 없이 예외를 전파해야 한다", async () => {
		mockAccess.enforcePremium.mockRejectedValue(
			new ApplicationException(ErrorCode.AI_1308),
		);

		await expect(useCase.execute("user-123", tz)).rejects.toBeInstanceOf(
			ApplicationException,
		);
		expect(mockRepository.findLatest).not.toHaveBeenCalled();
	});

	it("daysUntil은 시간이 아닌 날짜(calendar day) 기준으로 계산해야 한다", async () => {
		// 일요일 23:00 KST (= 14:00 UTC) → 다음 월요일까지 D-1
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-03-08T14:00:00Z"));

		const result = await useCase.execute("user-123", tz);

		expect(result.daysUntilWeekly).toBe(1);

		jest.useRealTimers();
	});

	it("최신 리포트를 반환하고 findLatest를 2회 호출해야 한다", async () => {
		mockRepository.findLatest.mockImplementation(
			async (_userId: string, type: ReportType) =>
				type === "WEEKLY" ? makeReport("WEEKLY") : null,
		);

		const result = await useCase.execute("user-123", tz);

		expect(result.nextWeeklyAt).toBeDefined();
		expect(result.nextMonthlyAt).toBeDefined();
		expect(result.daysUntilWeekly).toBeGreaterThanOrEqual(0);
		expect(result.daysUntilMonthly).toBeGreaterThanOrEqual(0);
		expect(result.latestWeekly).not.toBeNull();
		expect(result.latestMonthly).toBeNull();
		expect(mockRepository.findLatest).toHaveBeenCalledTimes(2);
	});
});
