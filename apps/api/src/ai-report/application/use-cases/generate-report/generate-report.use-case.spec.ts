/**
 * GenerateReportUseCase 단위 테스트
 *
 * - exists 가드: 이미 존재하면 skip(null), 집계/생성/저장 미호출
 * - 오케스트레이션: TODO_STATS_READER → AI_PROVIDER → repository.create
 * - AI 불가용/실패 시 폴백 콘텐츠로 저장
 * - 프리미엄 게이트 없음(크론 경로)
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { AI_PROVIDER, type AiProvider } from "@/ai";

import { AiReport } from "../../../domain/entities/ai-report.entity";
import type { AggregationInputs } from "../../../domain/types";
import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { TODO_STATS_READER, type TodoStatsReaderPort } from "../../ports/todo-stats.reader.port";
import { GenerateReportUseCase } from "./generate-report.use-case";

const mockUserId = "user-123";
const mockTimezone = "Asia/Seoul";

/** 활동 없는 최소 집계 입력 (도메인 계산은 report-aggregation 스펙이 별도 검증) */
const emptyInputs: AggregationInputs = {
	dailyTotalGroups: [],
	dailyCompletedGroups: [],
	prevTotalCount: 0,
	prevCompletedCount: 0,
	catTotalGroups: [],
	catCompletedGroups: [],
	categories: [],
	completedTodos: [],
};

const aiResult = {
	output: { summary: "AI 요약", tips: ["AI 팁"] },
	model: "test-model",
	usage: { input: 10, output: 20 },
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
	let mockReader: Mocked<TodoStatsReaderPort>;
	let mockAiProvider: Mocked<AiProvider>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GenerateReportUseCase).compile();
		useCase = unit;
		mockRepository = unitRef.get(AI_REPORT_REPOSITORY);
		mockReader = unitRef.get(TODO_STATS_READER);
		mockAiProvider = unitRef.get(AI_PROVIDER);

		mockReader.fetchAggregationInputs.mockResolvedValue(emptyInputs);
		mockRepository.findLatest.mockResolvedValue(null);
		mockRepository.create.mockResolvedValue(makeReport());
		mockAiProvider.isAvailable.mockReturnValue(true);
		mockAiProvider.generateStructured.mockResolvedValue(aiResult);
	});

	it("이미 존재하는 주간 리포트면 null 반환 + 후속 미호출", async () => {
		mockRepository.exists.mockResolvedValue(true);

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "WEEKLY",
		});

		expect(result).toBeNull();
		expect(mockReader.fetchAggregationInputs).not.toHaveBeenCalled();
		expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
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
		expect(mockReader.fetchAggregationInputs).not.toHaveBeenCalled();
	});

	it("주간: reader → AI → repository.create 순서로 실행", async () => {
		mockRepository.exists.mockResolvedValue(false);

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "WEEKLY",
		});

		expect(mockReader.fetchAggregationInputs).toHaveBeenCalledTimes(1);
		expect(mockAiProvider.generateStructured).toHaveBeenCalledTimes(1);
		expect(mockRepository.create).toHaveBeenCalledTimes(1);
		expect(result?.id).toBe(1);

		const readerCall = mockReader.fetchAggregationInputs.mock.calls[0]?.[0];
		expect(readerCall?.userId).toBe(mockUserId);
		expect(readerCall?.timezone).toBe(mockTimezone);
		expect(readerCall?.startDate).toBeInstanceOf(Date);
		expect(readerCall?.endDate).toBeInstanceOf(Date);

		// AI 출력이 저장 페이로드로 전달되는지 확인
		const createCall = mockRepository.create.mock.calls[0]?.[0];
		expect(createCall?.type).toBe("WEEKLY");
		expect(createCall?.aiSummary).toBe("AI 요약");
		expect(createCall?.aiTips).toEqual(["AI 팁"]);
	});

	it("월간: 리포트를 정상 생성해야 한다", async () => {
		mockRepository.exists.mockResolvedValue(false);

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "MONTHLY",
		});

		expect(result).not.toBeNull();
		expect(mockRepository.create).toHaveBeenCalledTimes(1);
		expect(mockRepository.create.mock.calls[0]?.[0]?.type).toBe("MONTHLY");
	});

	it("AI Provider 불가용 시 폴백 콘텐츠로 저장한다", async () => {
		mockRepository.exists.mockResolvedValue(false);
		mockAiProvider.isAvailable.mockReturnValue(false);

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "WEEKLY",
		});

		expect(result).not.toBeNull();
		expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
		expect(mockRepository.create).toHaveBeenCalledTimes(1);
		// 폴백은 비어있지 않은 요약을 제공
		expect(mockRepository.create.mock.calls[0]?.[0]?.aiSummary).toBeTruthy();
	});

	it("AI 호출 실패 시 폴백 콘텐츠로 저장한다", async () => {
		mockRepository.exists.mockResolvedValue(false);
		mockAiProvider.generateStructured.mockRejectedValue(new Error("AI 오류"));

		const result = await useCase.execute({
			userId: mockUserId,
			timezone: mockTimezone,
			type: "WEEKLY",
		});

		expect(result).not.toBeNull();
		expect(mockRepository.create).toHaveBeenCalledTimes(1);
		expect(mockRepository.create.mock.calls[0]?.[0]?.aiSummary).toBeTruthy();
	});
});
