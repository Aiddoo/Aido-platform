/**
 * GetReportByIdUseCase 단위 테스트
 *
 * - 프리미엄 게이트 우선 검증
 * - 존재하는 리포트 → toView DTO
 * - 존재하지 않으면 AI_1304
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
import { GetReportByIdUseCase } from "./get-report-by-id.use-case";

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

describe("GetReportByIdUseCase", () => {
	let useCase: GetReportByIdUseCase;
	let mockRepository: Mocked<AiReportRepositoryPort>;
	let mockAccess: Mocked<ReportAccessService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(GetReportByIdUseCase).compile();
		useCase = unit;
		mockRepository = unitRef.get(AI_REPORT_REPOSITORY);
		mockAccess = unitRef.get(ReportAccessService);
	});

	it("비프리미엄이면 조회 없이 예외를 전파해야 한다", async () => {
		mockAccess.enforcePremium.mockRejectedValue(
			new ApplicationException(ErrorCode.AI_1308),
		);

		await expect(useCase.execute("user-123", 1)).rejects.toBeInstanceOf(
			ApplicationException,
		);
		expect(mockRepository.findByIdAndUserId).not.toHaveBeenCalled();
	});

	it("존재하는 리포트를 DTO로 반환해야 한다", async () => {
		mockRepository.findByIdAndUserId.mockResolvedValue(makeReport(42));

		const result = await useCase.execute("user-123", 42);

		expect(result.id).toBe(42);
		expect(mockRepository.findByIdAndUserId).toHaveBeenCalledWith(
			42,
			"user-123",
		);
	});

	it("존재하지 않으면 AI_1304를 던져야 한다", async () => {
		mockRepository.findByIdAndUserId.mockResolvedValue(null);

		await expect(useCase.execute("user-123", 999)).rejects.toMatchObject({
			errorCode: "AI_1304",
		});
	});
});
