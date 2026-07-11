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
import { AI_PROVIDER, type AiProvider } from "@/ai";

import type {
	AggregatedReportData,
	GenerateReportParams,
} from "../../domain/types";
import { ReportGeneratorService } from "./report-generator.service";

describe("ReportGeneratorService — 리포트 생성 서비스", () => {
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
		prevTips: null,
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

	describe("AI 호출 성공", () => {
		it("AI가 가용하고 정상 응답하면 생성된 콘텐츠를 반환해야 한다", async () => {
			mockAiProvider.isAvailable.mockReturnValue(true);
			mockAiProvider.generateStructured.mockResolvedValue({
				output: {
					summary: "이번 주 정말 잘했어!",
					tips: ["아침에 할 일을 정리해봐!"],
				},
				model: "google:gemini-2.0-flash",
				usage: { input: 300, output: 100 },
			});

			const result = await service.generate(mockParams);

			expect(result.aiSummary).toBe("이번 주 정말 잘했어!");
			expect(result.aiTips).toEqual(["아침에 할 일을 정리해봐!"]);
			expect(mockAiProvider.generateStructured).toHaveBeenCalledTimes(1);
		});

		it("generateStructured에 올바른 파라미터를 전달해야 한다", async () => {
			mockAiProvider.isAvailable.mockReturnValue(true);
			mockAiProvider.generateStructured.mockResolvedValue({
				output: { summary: "요약", tips: ["팁"] },
				model: "google:gemini-2.0-flash",
				usage: { input: 300, output: 100 },
			});

			await service.generate(mockParams);

			const callArgs = mockAiProvider.generateStructured.mock.calls[0]?.[0];
			expect(callArgs?.prompt).toContain("아이도냥");
			expect(callArgs?.schema).toBeDefined();
			expect(callArgs?.maxOutputTokens).toBe(800);
			expect(callArgs?.temperature).toBe(0.7);
		});
	});

	describe("AI 불가용 시 폴백", () => {
		it("AI가 불가용하면 활동이 있는 경우의 폴백 콘텐츠를 반환해야 한다", async () => {
			mockAiProvider.isAvailable.mockReturnValue(false);

			const result = await service.generate(mockParams);

			expect(result.aiSummary.length).toBeGreaterThan(0);
			expect(result.aiTips.length).toBeGreaterThan(0);
			expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
		});

		it("en 로케일이면 영어 폴백 콘텐츠를 반환해야 한다", async () => {
			mockAiProvider.isAvailable.mockReturnValue(false);
			const enParams: GenerateReportParams = { ...mockParams, locale: "en" };

			const result = await service.generate(enParams);

			expect(result.aiSummary).toContain("to-do stats");
			expect(result.aiSummary).not.toContain("리포트");
		});

		it("en 로케일 + 활동 없음이면 영어 활동 없음 폴백을 반환해야 한다", async () => {
			mockAiProvider.isAvailable.mockReturnValue(false);
			const enNoActivityParams: GenerateReportParams = {
				...mockParams,
				locale: "en",
				aggregatedData: { ...mockAggregatedData, hasActivity: false },
			};

			const result = await service.generate(enNoActivityParams);

			expect(result.aiSummary).toContain("No to-dos were registered");
		});

		it("AI가 불가용하고 활동이 없으면 활동 없음 폴백을 반환해야 한다", async () => {
			mockAiProvider.isAvailable.mockReturnValue(false);
			const noActivityParams: GenerateReportParams = {
				...mockParams,
				aggregatedData: { ...mockAggregatedData, hasActivity: false },
			};

			const result = await service.generate(noActivityParams);

			expect(result.aiSummary).toContain("등록된 할 일이 없었어요");
			expect(result.aiTips.length).toBeGreaterThan(0);
		});
	});

	describe("주간/월간 프롬프트 분기", () => {
		beforeEach(() => {
			mockAiProvider.isAvailable.mockReturnValue(true);
			mockAiProvider.generateStructured.mockResolvedValue({
				output: { summary: "요약", tips: ["팁"] },
				model: "google:gemini-2.0-flash",
				usage: { input: 300, output: 100 },
			});
		});

		it("WEEKLY type이면 주간 키워드가 프롬프트에 포함되어야 한다", async () => {
			await service.generate(mockParams);

			const callArgs = mockAiProvider.generateStructured.mock.calls[0]?.[0];
			expect(callArgs?.prompt).toContain("코칭해줘");
			expect(callArgs?.prompt).toContain("★ summary 작성법");
			expect(callArgs?.prompt).toContain("주중");
		});

		it("MONTHLY type이면 월간 키워드가 프롬프트에 포함되어야 한다", async () => {
			const monthlyParams: GenerateReportParams = {
				...mockParams,
				type: "MONTHLY",
				periodLabel: "2026년 3월",
			};

			await service.generate(monthlyParams);

			const callArgs = mockAiProvider.generateStructured.mock.calls[0]?.[0];
			expect(callArgs?.prompt).toContain("월간 코칭");
			expect(callArgs?.prompt).toContain("한 달");
			expect(callArgs?.prompt).toContain("★ summary 작성법");
		});

		it("지난 기간 대비 변화량이 프롬프트에 포함되어야 한다", async () => {
			await service.generate(mockParams);

			const callArgs = mockAiProvider.generateStructured.mock.calls[0]?.[0];
			expect(callArgs?.prompt).toContain("+10%p");
		});

		it("활동 없음 + WEEKLY이면 주간 활동없음 프롬프트를 생성해야 한다", async () => {
			const params: GenerateReportParams = {
				...mockParams,
				aggregatedData: { ...mockAggregatedData, hasActivity: false },
			};

			await service.generate(params);

			const callArgs = mockAiProvider.generateStructured.mock.calls[0]?.[0];
			expect(callArgs?.prompt).toContain("10주차");
			expect(callArgs?.prompt).not.toContain("한 달");
		});

		it("활동 없음 + MONTHLY이면 월간 활동없음 프롬프트를 생성해야 한다", async () => {
			const params: GenerateReportParams = {
				...mockParams,
				type: "MONTHLY",
				periodLabel: "2026년 3월",
				aggregatedData: { ...mockAggregatedData, hasActivity: false },
			};

			await service.generate(params);

			const callArgs = mockAiProvider.generateStructured.mock.calls[0]?.[0];
			expect(callArgs?.prompt).toContain("한 달");
		});
	});

	describe("AI 호출 실패 시 폴백", () => {
		it("AI 호출 중 에러가 발생하면 폴백 콘텐츠를 반환해야 한다", async () => {
			mockAiProvider.isAvailable.mockReturnValue(true);
			mockAiProvider.generateStructured.mockRejectedValue(
				new Error("AI API 호출 실패"),
			);

			const result = await service.generate(mockParams);

			expect(result.aiSummary.length).toBeGreaterThan(0);
			expect(result.aiTips.length).toBeGreaterThan(0);
		});
	});
});
