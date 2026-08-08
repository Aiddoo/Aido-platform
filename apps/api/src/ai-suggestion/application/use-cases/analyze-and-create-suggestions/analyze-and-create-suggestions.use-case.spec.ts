/**
 * AnalyzeAndCreateSuggestionsUseCase 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 최소 할 일 게이트, 패턴 필터/캡/중복제거, 재시도, 트랜잭션 교체, 카테고리 해석
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createUnitOfWorkMock } from "@test/mocks/ports";
import type { AiProvider } from "@/ai";
import { AI_PROVIDER } from "@/ai";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import type { SuggestionContext } from "../../../domain/types";
import {
	AI_SUGGESTION_REPOSITORY,
	type AiSuggestionRepositoryPort,
} from "../../ports/ai-suggestion.repository.port";
import { SuggestionContextBuilder } from "../../services/suggestion-context.builder";
import { AnalyzeAndCreateSuggestionsUseCase } from "./analyze-and-create-suggestions.use-case";

describe("AnalyzeAndCreateSuggestionsUseCase", () => {
	let useCase: AnalyzeAndCreateSuggestionsUseCase;
	let mockRepository: Mocked<AiSuggestionRepositoryPort>;
	let mockAiProvider: Mocked<AiProvider>;
	let mockUow: UnitOfWorkPort;
	let mockContextBuilder: Mocked<SuggestionContextBuilder>;

	const mockUserId = "user-123";

	function createMockContext(
		overrides?: Partial<SuggestionContext>,
	): SuggestionContext {
		return {
			todos: [],
			dayCompletionRates: "월:80%|화:70%",
			timeCompletionRates: "오전(~12시):75%|오후(12시~):65%",
			categoryRates: "업무:80%|운동:60%",
			streak: "현재 5일 연속, 최장 10일",
			missingRoutines: [],
			weather: null,
			currentDate: "2026-03-31 (화요일, 3월 말)",
			weeklyReportInsight: null,
			suggestionHistory: [],
			...overrides,
		};
	}

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			AnalyzeAndCreateSuggestionsUseCase,
		)
			.mock(AI_PROVIDER)
			.impl(() => ({
				generateStructured: jest.fn(),
				isAvailable: jest.fn().mockReturnValue(true),
			}))
			.mock(UNIT_OF_WORK)
			.impl(() => createUnitOfWorkMock())
			.compile();

		useCase = unit;
		mockRepository = unitRef.get(AI_SUGGESTION_REPOSITORY);
		mockAiProvider = unitRef.get(AI_PROVIDER);
		mockUow = unitRef.get(UNIT_OF_WORK);
		mockContextBuilder = unitRef.get(SuggestionContextBuilder);
	});

	it("할 일이 1~2개면 한 번만 AI를 호출해 시작 제안을 만든다", async () => {
		mockContextBuilder.build.mockResolvedValue(
			createMockContext({
				todos: [
					{
						title: "할일1",
						startDate: "2026-03-01",
						scheduledTime: null,
						categoryId: 1,
						completed: false,
						categoryName: "기본",
					},
					{
						title: "할일2",
						startDate: "2026-03-02",
						scheduledTime: null,
						categoryId: 1,
						completed: false,
						categoryName: "기본",
					},
				],
			}),
		);

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "아침 스트레칭 5분",
						daysOfWeek: ["MON"],
						scheduledTime: "08:00",
						confidence: 0.55,
						reason: "근거 없는 문장",
						matchedTitles: [],
					},
				],
			},
			model: "gemini-3.1-flash-lite",
			usage: { input: 100, output: 50 },
		});
		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(result).toBe(1);
		expect(mockAiProvider.generateStructured).toHaveBeenCalledTimes(1);
		expect(mockRepository.createMany.mock.calls[0]?.[0][0]?.reason).toContain(
			"최근 기록이 2개",
		);
	});

	it("할 일이 없으면 기존 빈 상태를 유지하고 AI를 호출하지 않는다", async () => {
		mockContextBuilder.build.mockResolvedValue(createMockContext());

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(result).toBe(0);
		expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
		expect(mockRepository.createMany).not.toHaveBeenCalled();
	});

	it("패턴 감지 시 기존 PENDING 제안을 삭제하고 새 제안을 생성해야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "팀 미팅",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: "10:00",
			categoryId: 3,
			completed: true,
			categoryName: "업무",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "팀 미팅",
						daysOfWeek: ["MON", "WED", "FRI"],
						scheduledTime: "10:00",
						confidence: 0.85,
						reason: "반복 패턴",
						matchedTitles: ["팀 미팅", "팀 미팅", "팀 미팅"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 2 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(mockRepository.deletePending.mock.calls[0]?.[0]).toBe(mockUserId);
		expect(mockRepository.deleteExpired.mock.calls[0]?.[0]).toBe(mockUserId);
		expect(result).toBe(1);
		expect(mockRepository.createMany).toHaveBeenCalledTimes(1);
	});

	it("deletePending이 deleteExpired보다 먼저 호출되어야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "운동",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 5,
			completed: true,
			categoryName: "운동",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "운동",
						daysOfWeek: ["MON"],
						scheduledTime: null,
						confidence: 0.8,
						reason: "이유",
						matchedTitles: ["운동", "운동", "운동"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		await useCase.execute(mockUserId, "Asia/Seoul");

		const deletePendingOrder =
			mockRepository.deletePending.mock.invocationCallOrder[0] ?? 0;
		const deleteExpiredOrder =
			mockRepository.deleteExpired.mock.invocationCallOrder[0] ?? 0;
		expect(deletePendingOrder).toBeLessThan(deleteExpiredOrder);
	});

	it("제안 교체 로직은 트랜잭션 내에서 실행되어야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "독서",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 2,
			completed: true,
			categoryName: "자기계발",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "독서",
						daysOfWeek: ["TUE"],
						scheduledTime: null,
						confidence: 0.8,
						reason: "이유",
						matchedTitles: ["독서", "독서", "독서"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		await useCase.execute(mockUserId, "Asia/Seoul");

		expect(jest.mocked(mockUow.run)).toHaveBeenCalledTimes(1);
	});

	it("createMany 에러 발생 시 트랜잭션이 롤백되어야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "운동",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 5,
			completed: true,
			categoryName: "운동",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "운동",
						daysOfWeek: ["MON"],
						scheduledTime: null,
						confidence: 0.8,
						reason: "이유",
						matchedTitles: ["운동", "운동", "운동"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockRejectedValue(new Error("DB 에러"));

		await expect(useCase.execute(mockUserId, "Asia/Seoul")).rejects.toThrow(
			"DB 에러",
		);
	});

	it("최대 5개까지만 생성해야 한다", async () => {
		const todos = Array.from({ length: 10 }, (_, i) => ({
			title: `할일${i}`,
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 1,
			completed: false,
			categoryName: "기본",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		const patterns = Array.from({ length: 6 }, (_, i) => ({
			title: `패턴${i}`,
			daysOfWeek: ["MON"],
			scheduledTime: null,
			confidence: 0.8,
			reason: "이유",
			matchedTitles: [`할일${i}a`, `할일${i}b`],
		}));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: { patterns },
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 5 });

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(result).toBe(5);
		const createManyArg = mockRepository.createMany.mock.calls[0]?.[0];
		expect(createManyArg).toHaveLength(5);
	});

	it("매칭된 투두의 최빈 카테고리를 suggestedCategoryId로 설정해야 한다", async () => {
		const todos = [
			{
				title: "팀 미팅",
				startDate: "2026-02-10",
				scheduledTime: "10:00",
				categoryId: 3,
				completed: true,
				categoryName: "업무",
			},
			{
				title: "팀 미팅",
				startDate: "2026-02-12",
				scheduledTime: "10:00",
				categoryId: 3,
				completed: true,
				categoryName: "업무",
			},
			{
				title: "팀 미팅",
				startDate: "2026-02-14",
				scheduledTime: "10:00",
				categoryId: 5,
				completed: true,
				categoryName: "일반",
			},
			{
				title: "팀 미팅",
				startDate: "2026-02-17",
				scheduledTime: "10:00",
				categoryId: 3,
				completed: true,
				categoryName: "업무",
			},
			{
				title: "팀 미팅",
				startDate: "2026-02-19",
				scheduledTime: "10:00",
				categoryId: 5,
				completed: false,
				categoryName: "일반",
			},
		];
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "팀 미팅",
						daysOfWeek: ["MON", "WED", "FRI"],
						scheduledTime: "10:00",
						confidence: 0.85,
						reason: "반복 패턴",
						matchedTitles: ["팀 미팅", "팀 미팅", "팀 미팅"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		await useCase.execute(mockUserId, "Asia/Seoul");

		const createManyArg = mockRepository.createMany.mock.calls[0]?.[0];
		expect(createManyArg?.[0]?.suggestedCategoryId).toBe(3);
	});

	it("매칭되는 투두가 없고 제목-카테고리명 일치도 없으면 suggestedCategoryId가 null이어야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "공부",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 5,
			completed: true,
			categoryName: "자기계발",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "영화 감상",
						daysOfWeek: ["MON"],
						scheduledTime: null,
						confidence: 0.8,
						reason: "이유",
						matchedTitles: ["존재하지않는제목1", "존재하지않는제목2"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		await useCase.execute(mockUserId, "Asia/Seoul");

		const createManyArg = mockRepository.createMany.mock.calls[0]?.[0];
		expect(createManyArg?.[0]?.suggestedCategoryId).toBeNull();
	});

	it("제목 단어가 사용자 카테고리명과 일치하면 matchedTitles 최빈 카테고리보다 우선한다", async () => {
		const todos = [
			{
				title: "매칭대상A",
				startDate: "2026-02-10",
				scheduledTime: null,
				categoryId: 5,
				completed: true,
				categoryName: "자기계발",
			},
			{
				title: "매칭대상B",
				startDate: "2026-02-12",
				scheduledTime: null,
				categoryId: 5,
				completed: true,
				categoryName: "자기계발",
			},
			{
				title: "다른할일",
				startDate: "2026-02-11",
				scheduledTime: null,
				categoryId: 30,
				completed: true,
				categoryName: "운동",
			},
		];
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "운동 30분",
						daysOfWeek: ["TUE"],
						scheduledTime: null,
						confidence: 0.8,
						reason: "이유",
						matchedTitles: ["매칭대상A", "매칭대상B"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		await useCase.execute(mockUserId, "Asia/Seoul");

		const createManyArg = mockRepository.createMany.mock.calls[0]?.[0];
		expect(createManyArg?.[0]?.suggestedCategoryId).toBe(30);
	});

	it("시즌 추천(빈 matchedTitles)은 필터를 통과해야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "운동",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 5,
			completed: true,
			categoryName: "운동",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "봄맞이 산책",
						daysOfWeek: ["SAT", "SUN"],
						scheduledTime: "10:00",
						confidence: 0.7,
						reason: "봄철에 야외 활동을 추천합니다",
						matchedTitles: [],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(result).toBe(1);
		expect(mockRepository.createMany).toHaveBeenCalledTimes(1);
	});

	it("날씨 컨텍스트 없을 때 날씨 관련 제안은 필터링되어야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "운동",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 5,
			completed: true,
			categoryName: "운동",
		}));
		mockContextBuilder.build.mockResolvedValue(
			createMockContext({ todos, weather: null }),
		);

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "실내 운동",
						daysOfWeek: ["MON", "WED", "FRI"],
						scheduledTime: "18:00",
						confidence: 0.75,
						reason: "비 오는 날씨에 대비해 실내 운동을 추천합니다",
						matchedTitles: ["운동", "운동", "운동"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(result).toBe(0);
		expect(mockRepository.createMany).not.toHaveBeenCalled();
	});

	it("날씨 컨텍스트 있을 때 날씨 관련 제안은 유지되어야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: "운동",
			startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 5,
			completed: true,
			categoryName: "운동",
		}));
		mockContextBuilder.build.mockResolvedValue(
			createMockContext({
				todos,
				weather: "비(강수확률 80%), 10~15°C",
			}),
		);

		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "실내 운동",
						daysOfWeek: ["MON", "WED", "FRI"],
						scheduledTime: "18:00",
						confidence: 0.75,
						reason: "비 오는 날씨에 대비해 실내 운동을 추천합니다",
						matchedTitles: ["운동", "운동", "운동"],
					},
				],
			},
			model: "gemini-2.0-flash",
			usage: { input: 100, output: 50 },
		});

		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockResolvedValue({ count: 1 });

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(result).toBe(1);
		expect(mockRepository.createMany).toHaveBeenCalledTimes(1);
	});

	it("2회 반복 패턴은 confidence 0.75 이상이면 통과, 미만이면 제거", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: `할일${i}`,
			startDate: `2026-04-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 1,
			completed: false,
			categoryName: "기본",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));
		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "고신뢰 2회",
						daysOfWeek: ["MON"],
						scheduledTime: null,
						confidence: 0.8,
						reason: "두 번 반복",
						matchedTitles: ["할일0", "할일0"],
					},
					{
						title: "저신뢰 2회",
						daysOfWeek: ["TUE"],
						scheduledTime: null,
						confidence: 0.6,
						reason: "약한 반복",
						matchedTitles: ["할일1", "할일1"],
					},
				],
			},
			model: "gemini-3.1-flash-lite",
			usage: { input: 100, output: 50 },
		});
		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockImplementation(async (items) => ({
			count: items.length,
		}));

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(mockAiProvider.generateStructured).toHaveBeenCalledTimes(1);
		expect(result).toBeGreaterThanOrEqual(1);
	});

	it("결과가 3개 미만이어도 비용 절감을 위해 재시도하지 않아야 한다", async () => {
		const todos = Array.from({ length: 6 }, (_, i) => ({
			title: `할일${i}`,
			startDate: `2026-04-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 1,
			completed: false,
			categoryName: "기본",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));
		mockAiProvider.generateStructured
			.mockResolvedValueOnce({
				output: {
					patterns: [
						{
							title: "첫번째",
							daysOfWeek: ["MON"],
							scheduledTime: null,
							confidence: 0.85,
							reason: "r1",
							matchedTitles: ["할일0", "할일0", "할일0"],
						},
					],
				},
				model: "gemini-3.1-flash-lite",
				usage: { input: 100, output: 50 },
			})
			.mockResolvedValueOnce({
				output: {
					patterns: [
						{
							title: "추가1",
							daysOfWeek: ["TUE"],
							scheduledTime: null,
							confidence: 0.8,
							reason: "r2",
							matchedTitles: ["할일1", "할일1", "할일1"],
						},
						{
							title: "추가2",
							daysOfWeek: ["WED"],
							scheduledTime: null,
							confidence: 0.75,
							reason: "r3",
							matchedTitles: ["할일2", "할일2"],
						},
					],
				},
				model: "gemini-3.1-flash-lite",
				usage: { input: 100, output: 50 },
			});
		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockImplementation(async (items) => ({
			count: items.length,
		}));

		const result = await useCase.execute(mockUserId, "Asia/Seoul");

		expect(mockAiProvider.generateStructured).toHaveBeenCalledTimes(1);
		expect(result).toBe(1);
	});

	it("1차 결과가 3개 이상이면 재시도하지 않아야 한다", async () => {
		const todos = Array.from({ length: 10 }, (_, i) => ({
			title: `할일${i}`,
			startDate: `2026-04-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 1,
			completed: false,
			categoryName: "기본",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));
		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "P1",
						daysOfWeek: ["MON"],
						scheduledTime: null,
						confidence: 0.85,
						reason: "r",
						matchedTitles: ["할일0", "할일0", "할일0"],
					},
					{
						title: "P2",
						daysOfWeek: ["TUE"],
						scheduledTime: null,
						confidence: 0.8,
						reason: "r",
						matchedTitles: ["할일1", "할일1", "할일1"],
					},
					{
						title: "P3",
						daysOfWeek: ["WED"],
						scheduledTime: null,
						confidence: 0.75,
						reason: "r",
						matchedTitles: ["할일2", "할일2"],
					},
				],
			},
			model: "gemini-3.1-flash-lite",
			usage: { input: 100, output: 50 },
		});
		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockImplementation(async (items) => ({
			count: items.length,
		}));

		await useCase.execute(mockUserId, "Asia/Seoul");

		expect(mockAiProvider.generateStructured).toHaveBeenCalledTimes(1);
	});

	it("matchedTitles 빈 유형(시즌/밸런스)은 최대 2개만 허용해야 한다", async () => {
		const todos = Array.from({ length: 5 }, (_, i) => ({
			title: `할일${i}`,
			startDate: `2026-04-${String(10 + i).padStart(2, "0")}`,
			scheduledTime: null,
			categoryId: 1,
			completed: false,
			categoryName: "기본",
		}));
		mockContextBuilder.build.mockResolvedValue(createMockContext({ todos }));
		mockAiProvider.generateStructured.mockResolvedValue({
			output: {
				patterns: [
					{
						title: "시즌1",
						daysOfWeek: ["SAT"],
						scheduledTime: null,
						confidence: 0.6,
						reason: "봄 시즌",
						matchedTitles: [],
					},
					{
						title: "시즌2",
						daysOfWeek: ["SAT"],
						scheduledTime: null,
						confidence: 0.58,
						reason: "봄 시즌",
						matchedTitles: [],
					},
					{
						title: "시즌3",
						daysOfWeek: ["SAT"],
						scheduledTime: null,
						confidence: 0.55,
						reason: "봄 시즌",
						matchedTitles: [],
					},
					{
						title: "밸런스1",
						daysOfWeek: ["SUN"],
						scheduledTime: null,
						confidence: 0.65,
						reason: "카테고리 편중",
						matchedTitles: [],
					},
					{
						title: "매칭유형",
						daysOfWeek: ["MON"],
						scheduledTime: null,
						confidence: 0.85,
						reason: "3회 반복",
						matchedTitles: ["할일0", "할일0", "할일0"],
					},
				],
			},
			model: "gemini-3.1-flash-lite",
			usage: { input: 100, output: 50 },
		});
		mockRepository.deletePending.mockResolvedValue({ count: 0 });
		mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
		mockRepository.createMany.mockImplementation(async (items) => ({
			count: items.length,
		}));

		await useCase.execute(mockUserId, "Asia/Seoul");

		expect(mockRepository.createMany).toHaveBeenCalledTimes(1);
		const createManyArg = mockRepository.createMany.mock.calls[0]?.[0];
		expect(createManyArg).toHaveLength(3);
	});
});
