/**
 * GenerateReportUseCase 단위 테스트
 *
 * - exists 가드: 이미 존재하면 skip(null), 집계/생성/저장 미호출
 * - 오케스트레이션 순서: aggregator → generator → repository.create
 * - 프리미엄 게이트 없음(크론 경로)
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { AiReport } from "../../../domain/entities/ai-report.entity";
import type { AggregatedReportData } from "../../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { ReportAggregatorService } from "../../services/report-aggregator.service";
import { ReportGeneratorService } from "../../services/report-generator.service";
import { GenerateReportUseCase } from "./generate-report.use-case";

const mockUserId = "user-123";
const mockTimezone = "Asia/Seoul";

const aggregated: AggregatedReportData = {
	totalTodos: 10,
	completedTodos: 8,
	completionRate: 80,
	prevCompletionRate: 70,
	streakDays: 3,
	categoryBreakdown: [],
	dayPatterns: [],
	timePatterns: [],
	hasActivity: true,
};

const makeReport = (): AiReport =>
	AiReport.reconstitute({
		id: 1,
		userId: mockUserId,
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
		aiTips: ["팁"],
		locale: "ko",
		hasActivity: true,
		generatedAt: new Date("2026-03-09T07:00:00.000Z"),
	});

describe("GenerateReportUseCase", () => {
	let useCase: GenerateReportUseCase;
	let mockRepository: Mocked<AiReportRepositoryPort>;
	let mockAggregator: Mocked<ReportAggregatorService>;
	let mockGenerator: Mocked<ReportGeneratorService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			GenerateReportUseCase,
		).compile();
		useCase = unit;
		mockRepository = unitRef.get(AI_REPORT_REPOSITORY);
		mockAggregator = unitRef.get(ReportAggregatorService);
		mockGenerator = unitRef.get(ReportGeneratorService);
	});

	it("이미 존재하는 주간 리포트면 null 반환 + 후속 미호출", async () => {
		mockRepository.exists.mockResolvedValue(true);

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "WEEKLY",
		});

		expect(result).toBeNull();
		expect(mockAggregator.aggregate).not.toHaveBeenCalled();
		expect(mockGenerator.generate).not.toHaveBeenCalled();
		expect(mockRepository.create).not.toHaveBeenCalled();
	});

	it("이미 존재하는 월간 리포트면 null 반환", async () => {
		mockRepository.exists.mockResolvedValue(true);

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "MONTHLY",
		});

		expect(result).toBeNull();
		expect(mockAggregator.aggregate).not.toHaveBeenCalled();
	});

	it("주간: aggregator → generator → repository.create 순서로 실행", async () => {
		mockRepository.exists.mockResolvedValue(false);
		mockAggregator.aggregate.mockResolvedValue(aggregated);
		mockGenerator.generate.mockResolvedValue({
			aiSummary: "이번 주 잘했어!",
			aiTips: ["계속 파이팅!"],
		});
		mockRepository.create.mockResolvedValue(makeReport());

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "WEEKLY",
		});

		expect(mockAggregator.aggregate).toHaveBeenCalledTimes(1);
		expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
		expect(mockRepository.create).toHaveBeenCalledTimes(1);
		expect(result?.id).toBe(1);

		const aggregateCall = mockAggregator.aggregate.mock.calls[0]?.[0];
		expect(aggregateCall?.userId).toBe(mockUserId);
		expect(aggregateCall?.timezone).toBe(mockTimezone);
		expect(aggregateCall?.startDate).toBeInstanceOf(Date);
		expect(aggregateCall?.endDate).toBeInstanceOf(Date);

		const generateCall = mockGenerator.generate.mock.calls[0]?.[0];
		expect(generateCall?.aggregatedData).toEqual(aggregated);
		expect(generateCall?.type).toBe("WEEKLY");
	});

	it("월간: 리포트를 정상 생성해야 한다", async () => {
		mockRepository.exists.mockResolvedValue(false);
		mockAggregator.aggregate.mockResolvedValue(aggregated);
		mockGenerator.generate.mockResolvedValue({
			aiSummary: "이번 달 잘했어!",
			aiTips: ["다음 달도 파이팅!"],
		});
		mockRepository.create.mockResolvedValue(makeReport());

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "MONTHLY",
		});

		expect(result).not.toBeNull();
		expect(mockRepository.create).toHaveBeenCalledTimes(1);
		const generateCall = mockGenerator.generate.mock.calls[0]?.[0];
		expect(generateCall?.type).toBe("MONTHLY");
	});
});
