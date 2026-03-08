/**
 * ReportGeneratorService 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - AI 호출 성공 시 콘텐츠 반환 검증
 * - AI 불가용 시 폴백 콘텐츠 반환 검증
 * - AI 호출 실패 시 폴백 콘텐츠 반환 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	AI_PROVIDER,
	type AiProvider,
} from "@/modules/ai/providers/ai.provider";

import { ReportGeneratorService } from "./report-generator.service";
import type { AggregatedReportData, GenerateReportParams } from "./types";

describe("ReportGeneratorService", () => {
	let service: ReportGeneratorService;
	let mockAiProvider: Mocked<AiProvider>;

	const mockAggregatedData: AggregatedReportData = {
		totalTodos: 10,
		completedTodos: 8,
		completionRate: 80,
		prevCompletionRate: 70,
		streakDays: 3,
		categoryBreakdown: [
			{ name: "업무", color: "#FF0000", total: 5, completed: 4, rate: 80 },
		],
		dayPatterns: [
			{ day: "MON", total: 3, completed: 2, rate: 67 },
			{ day: "TUE", total: 2, completed: 2, rate: 100 },
			{ day: "WED", total: 0, completed: 0, rate: 0 },
			{ day: "THU", total: 0, completed: 0, rate: 0 },
			{ day: "FRI", total: 3, completed: 2, rate: 67 },
			{ day: "SAT", total: 1, completed: 1, rate: 100 },
			{ day: "SUN", total: 1, completed: 1, rate: 100 },
		],
		timePatterns: [{ hour: 10, count: 5 }],
		hasActivity: true,
	};

	const mockParams: GenerateReportParams = {
		aggregatedData: mockAggregatedData,
		type: "WEEKLY",
		periodLabel: "2026년 10주차",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(ReportGeneratorService)
			.mock(AI_PROVIDER)
			.impl(() => ({
				generateStructured: jest.fn(),
				isAvailable: jest.fn(),
			}))
			.compile();

		service = unit;
		mockAiProvider = unitRef.get(AI_PROVIDER);
	});

	// =========================================================================
	// AI 호출 성공
	// =========================================================================

	describe("AI 호출 성공", () => {
		it("AI가 가용하고 정상 응답하면 생성된 콘텐츠를 반환해야 한다", async () => {
			// Given -AI Provider가 가용하고 정상 응답
			mockAiProvider.isAvailable.mockReturnValue(true);
			mockAiProvider.generateStructured.mockResolvedValue({
				output: {
					summary: "이번 주 정말 잘했어!",
					tips: ["아침에 할 일을 정리해봐!"],
				},
				model: "google:gemini-2.0-flash",
				usage: { input: 300, output: 100 },
			});

			// When -generate를 호출하면
			const result = await service.generate(mockParams);

			// Then -AI가 생성한 콘텐츠를 반환해야 한다
			expect(result.aiSummary).toBe("이번 주 정말 잘했어!");
			expect(result.aiTips).toEqual(["아침에 할 일을 정리해봐!"]);
			expect(mockAiProvider.generateStructured).toHaveBeenCalledTimes(1);
		});

		it("generateStructured에 올바른 파라미터를 전달해야 한다", async () => {
			// Given -AI Provider가 가용
			mockAiProvider.isAvailable.mockReturnValue(true);
			mockAiProvider.generateStructured.mockResolvedValue({
				output: { summary: "요약", tips: ["팁"] },
				model: "google:gemini-2.0-flash",
				usage: { input: 300, output: 100 },
			});

			// When -generate를 호출하면
			await service.generate(mockParams);

			// Then -prompt, schema, maxTokens, temperature가 전달되어야 한다
			const args = mockAiProvider.generateStructured.mock.calls[0];
			expect(args).toBeDefined();
			const callArgs = args?.[0];
			expect(callArgs?.prompt).toContain("아이도냥");
			expect(callArgs?.schema).toBeDefined();
			expect(callArgs?.maxTokens).toBe(500);
			expect(callArgs?.temperature).toBe(0.7);
		});
	});

	// =========================================================================
	// AI 불가용 시 폴백
	// =========================================================================

	describe("AI 불가용 시 폴백", () => {
		it("AI가 불가용하면 활동이 있는 경우의 폴백 콘텐츠를 반환해야 한다", async () => {
			// Given -AI Provider가 불가용
			mockAiProvider.isAvailable.mockReturnValue(false);

			// When -generate를 호출하면
			const result = await service.generate(mockParams);

			// Then -폴백 콘텐츠를 반환해야 한다
			expect(result.aiSummary).toBeDefined();
			expect(result.aiSummary.length).toBeGreaterThan(0);
			expect(result.aiTips).toBeDefined();
			expect(result.aiTips.length).toBeGreaterThan(0);
			expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
		});

		it("AI가 불가용하고 활동이 없으면 활동 없음 폴백을 반환해야 한다", async () => {
			// Given -AI Provider가 불가용하고 활동 없음
			mockAiProvider.isAvailable.mockReturnValue(false);
			const noActivityParams: GenerateReportParams = {
				...mockParams,
				aggregatedData: { ...mockAggregatedData, hasActivity: false },
			};

			// When -generate를 호출하면
			const result = await service.generate(noActivityParams);

			// Then -활동 없음 폴백 콘텐츠를 반환해야 한다
			expect(result.aiSummary).toContain("등록된 할 일이 없었어요");
			expect(result.aiTips.length).toBeGreaterThan(0);
		});
	});

	// =========================================================================
	// AI 호출 실패 시 폴백
	// =========================================================================

	describe("AI 호출 실패 시 폴백", () => {
		it("AI 호출 중 에러가 발생하면 폴백 콘텐츠를 반환해야 한다", async () => {
			// Given -AI Provider가 가용하지만 호출 시 에러 발생
			mockAiProvider.isAvailable.mockReturnValue(true);
			mockAiProvider.generateStructured.mockRejectedValue(
				new Error("AI API 호출 실패"),
			);

			// When -generate를 호출하면
			const result = await service.generate(mockParams);

			// Then -폴백 콘텐츠를 반환해야 한다 (에러가 전파되지 않음)
			expect(result.aiSummary).toBeDefined();
			expect(result.aiSummary.length).toBeGreaterThan(0);
			expect(result.aiTips).toBeDefined();
			expect(result.aiTips.length).toBeGreaterThan(0);
		});
	});
});
