/**
 * GetReportsUseCase 단위 테스트
 *
 * - 프리미엄 게이트 우선 검증
 * - 목록 조회 + toView 변환
 */

import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { AiReport } from "../../../domain/entities/ai-report.entity";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { ReportAccessService } from "../../services/report-access.service";
import { GetReportsUseCase } from "./get-reports.use-case";

const makeReport = (id: number): AiReport =>
	AiReport.reconstitute({
		id,
		userId: "user-123",
		type: "WEEKLY",
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

describe("GetReportsUseCase", () => {
	let useCase: GetReportsUseCase;
	let mockRepository: Mocked<AiReportRepositoryPort>;
	let mockAccess: Mocked<ReportAccessService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(GetReportsUseCase).compile();
		useCase = unit;
		mockRepository = unitRef.get(AI_REPORT_REPOSITORY);
		mockAccess = unitRef.get(ReportAccessService);
	});

	it("비프리미엄이면 조회 없이 예외를 전파해야 한다", async () => {
		mockAccess.enforcePremium.mockRejectedValue(
			new ApplicationException(ErrorCode.AI_1308),
		);

		await expect(
			useCase.execute("user-123", { type: "WEEKLY", limit: 10 }),
		).rejects.toBeInstanceOf(ApplicationException);
		expect(mockRepository.findMany).not.toHaveBeenCalled();
	});

	it("목록을 조회하고 DTO로 변환해야 한다", async () => {
		mockRepository.findMany.mockResolvedValue([makeReport(1)]);

		const result = await useCase.execute("user-123", {
			type: "WEEKLY",
			limit: 10,
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(1);
		expect(mockRepository.findMany).toHaveBeenCalledWith({
			userId: "user-123",
			type: "WEEKLY",
			limit: 10,
		});
	});
});
