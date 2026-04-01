/**
 * AiSuggestionService 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - handleAction: 다양한 에러 케이스 및 정상 플로우 검증
 * - analyzeAndCreateSuggestions: 분석 로직 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import type { RecurringSuggestion } from "@/generated/prisma/client";

import type { AiProvider } from "../ai/providers/ai.provider";
import { AI_PROVIDER } from "../ai/providers/ai.provider";
import { TodoService } from "../todo/todo.service";
import { AiSuggestionRepository } from "./ai-suggestion.repository";
import { AiSuggestionService } from "./ai-suggestion.service";
import { SuggestionContextBuilder } from "./suggestion-context.builder";
import type { SuggestionContext } from "./types";

describe("AiSuggestionService", () => {
	let service: AiSuggestionService;
	let mockRepository: Mocked<AiSuggestionRepository>;
	let mockTodoService: Mocked<TodoService>;
	let mockAiProvider: Mocked<AiProvider>;
	let mockEntitlementService: Mocked<EntitlementService>;
	let mockDatabase: Mocked<DatabaseService>;
	let mockContextBuilder: Mocked<SuggestionContextBuilder>;

	const mockUserId = "user-123";

	/**
	 * 테스트용 RecurringSuggestion 엔티티 생성 헬퍼
	 */
	function createMockSuggestionEntity(
		overrides?: Partial<RecurringSuggestion>,
	): RecurringSuggestion {
		return {
			id: 1,
			userId: mockUserId,
			title: "팀 미팅",
			daysOfWeek: ["MON", "WED", "FRI"],
			scheduledTime: "10:00",
			confidence: 0.85,
			reason: "매주 반복되는 패턴",
			matchedTodos: ["팀 미팅", "팀 회의"],
			status: "PENDING",
			suggestedCategoryId: 3,
			expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 후
			createdAt: new Date("2026-03-04T00:00:00.000Z"),
			updatedAt: new Date("2026-03-04T00:00:00.000Z"),
			...overrides,
		} as RecurringSuggestion;
	}

	/**
	 * 테스트용 SuggestionContext 생성 헬퍼
	 */
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
		const { unit, unitRef } = await TestBed.solitary(AiSuggestionService)
			.mock(AI_PROVIDER)
			.impl(() => ({
				generateStructured: jest.fn(),
				isAvailable: jest.fn().mockReturnValue(true),
			}))
			.compile();

		service = unit;
		mockRepository = unitRef.get(AiSuggestionRepository);
		mockTodoService = unitRef.get(TodoService);
		mockAiProvider = unitRef.get(AI_PROVIDER);
		mockEntitlementService = unitRef.get(EntitlementService);
		mockDatabase = unitRef.get(DatabaseService);
		mockContextBuilder = unitRef.get(SuggestionContextBuilder);

		// 기본: 프리미엄 사용자
		mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);

		// $transaction passthrough mock
		mockDatabase.$transaction.mockImplementation((callback) =>
			callback(mockRepository as never),
		);
	});

	// =========================================================================
	// 프리미엄 체크
	// =========================================================================

	describe("프리미엄 체크", () => {
		it("비프리미엄 사용자가 getPendingSuggestions를 호출하면 AI_1309 예외를 던져야 한다", async () => {
			// Given -비프리미엄 사용자
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then: 프리미엄 필수 예외가 발생해야 한다
			await expect(service.getPendingSuggestions(mockUserId)).rejects.toThrow(
				BusinessException,
			);

			expect(mockRepository.findPendingByUserId).not.toHaveBeenCalled();
		});

		it("비프리미엄 사용자가 handleAction을 호출하면 AI_1309 예외를 던져야 한다", async () => {
			// Given -비프리미엄 사용자
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then: 프리미엄 필수 예외가 발생해야 한다
			await expect(
				service.handleAction(
					mockUserId,
					1,
					{ action: "dismiss" },
					"Asia/Seoul",
				),
			).rejects.toThrow(BusinessException);

			expect(mockRepository.findByIdAndUserId).not.toHaveBeenCalled();
		});

		it("analyzeAndCreateSuggestions는 프리미엄 체크 없이 동작해야 한다", async () => {
			// Given -비프리미엄 사용자이지만 크론잡 호출
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);
			mockContextBuilder.build.mockResolvedValue(createMockContext());

			// When -analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(
				mockUserId,
				"Asia/Seoul",
			);

			// Then -프리미엄 체크 없이 정상 동작
			expect(mockEntitlementService.hasPremiumAccess).not.toHaveBeenCalled();
			expect(result).toBe(0);
		});
	});

	// =========================================================================
	// getPendingSuggestions
	// =========================================================================

	describe("getPendingSuggestions", () => {
		it("대기 중인 제안 목록을 DTO로 변환하여 반환해야 한다", async () => {
			// Given -대기 중인 제안 목록이 존재
			const suggestions = [createMockSuggestionEntity()];
			mockRepository.findPendingByUserId.mockResolvedValue(suggestions);

			// When -getPendingSuggestions를 호출하면
			const result = await service.getPendingSuggestions(mockUserId);

			// Then -DTO로 변환된 목록을 반환해야 한다
			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(1);
			expect(mockRepository.findPendingByUserId).toHaveBeenCalledWith(
				mockUserId,
			);
		});
	});

	// =========================================================================
	// handleAction
	// =========================================================================

	describe("handleAction", () => {
		it("존재하지 않는 제안에 대해 AI_1305 예외를 던져야 한다", async () => {
			// Given -제안이 존재하지 않음
			mockRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: aiSuggestionNotFound 예외가 발생해야 한다
			await expect(
				service.handleAction(
					mockUserId,
					999,
					{ action: "accept" },
					"Asia/Seoul",
				),
			).rejects.toThrow(BusinessException);

			expect(mockRepository.findByIdAndUserId).toHaveBeenCalledWith(
				999,
				mockUserId,
			);
		});

		it("이미 처리된 제안에 대해 AI_1306 예외를 던져야 한다", async () => {
			// Given -이미 ACCEPTED 상태인 제안
			const suggestion = createMockSuggestionEntity({
				status: "ACCEPTED",
			});
			mockRepository.findByIdAndUserId.mockResolvedValue(suggestion);

			// When & Then: aiSuggestionAlreadyProcessed 예외가 발생해야 한다
			await expect(
				service.handleAction(mockUserId, 1, { action: "accept" }, "Asia/Seoul"),
			).rejects.toThrow(BusinessException);
		});

		it("만료된 제안에 대해 AI_1307 예외를 던져야 한다", async () => {
			// Given -만료된 제안
			const suggestion = createMockSuggestionEntity({
				expiresAt: new Date("2020-01-01T00:00:00.000Z"), // 과거 날짜
			});
			mockRepository.findByIdAndUserId.mockResolvedValue(suggestion);

			// When & Then: aiSuggestionExpired 예외가 발생해야 한다
			await expect(
				service.handleAction(mockUserId, 1, { action: "accept" }, "Asia/Seoul"),
			).rejects.toThrow(BusinessException);
		});

		it("거절 시 상태를 DISMISSED로 업데이트해야 한다", async () => {
			// Given -PENDING 상태의 제안
			const suggestion = createMockSuggestionEntity();
			mockRepository.findByIdAndUserId.mockResolvedValue(suggestion);
			const updatedSuggestion = createMockSuggestionEntity({
				status: "DISMISSED",
			});
			mockRepository.updateStatus.mockResolvedValue(updatedSuggestion);

			// When -dismiss 액션을 수행하면
			const result = await service.handleAction(
				mockUserId,
				1,
				{ action: "dismiss" },
				"Asia/Seoul",
			);

			// Then -DISMISSED로 업데이트되어야 한다
			expect(mockRepository.updateStatus).toHaveBeenCalledWith(1, "DISMISSED");
			expect(result.suggestion.status).toBe("DISMISSED");
			expect(result.message).toContain("거절");
			expect(result.createdTodosCount).toBeUndefined();
			expect(mockTodoService.createRecurring).not.toHaveBeenCalled();
		});

		it("수락 시 상태를 먼저 ACCEPTED로 변경한 후 TodoService.createRecurring을 호출해야 한다", async () => {
			// Given -PENDING 상태의 제안과 TodoService 응답
			const suggestion = createMockSuggestionEntity();
			mockRepository.findByIdAndUserId.mockResolvedValue(suggestion);

			mockTodoService.createRecurring.mockResolvedValue({
				todos: [],
				count: 12,
			} as never);

			const updatedSuggestion = createMockSuggestionEntity({
				status: "ACCEPTED",
			});
			mockRepository.updateStatus.mockResolvedValue(updatedSuggestion);

			// When -accept 액션을 수행하면
			const result = await service.handleAction(
				mockUserId,
				1,
				{ action: "accept", categoryId: 5 },
				"Asia/Seoul",
			);

			// Then -상태가 먼저 ACCEPTED로 변경되고, 그 후 투두가 생성되어야 한다
			const updateStatusOrder =
				mockRepository.updateStatus.mock.invocationCallOrder[0];
			const createRecurringOrder =
				mockTodoService.createRecurring.mock.invocationCallOrder[0];
			expect(updateStatusOrder).toBeLessThan(createRecurringOrder as number);

			expect(mockRepository.updateStatus).toHaveBeenCalledWith(1, "ACCEPTED");
			expect(mockTodoService.createRecurring).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					title: "팀 미팅",
					categoryId: 5,
					daysOfWeek: ["MON", "WED", "FRI"],
					scheduledTime: "10:00",
				}),
				"Asia/Seoul",
			);
			expect(result.suggestion.status).toBe("ACCEPTED");
			expect(result.createdTodosCount).toBe(12);
		});

		it("수락 시 투두 생성 실패하면 상태가 PENDING으로 롤백되어야 한다", async () => {
			// Given -PENDING 상태의 제안, 투두 생성 실패
			const suggestion = createMockSuggestionEntity();
			mockRepository.findByIdAndUserId.mockResolvedValue(suggestion);

			const updatedSuggestion = createMockSuggestionEntity({
				status: "ACCEPTED",
			});
			mockRepository.updateStatus.mockResolvedValue(updatedSuggestion);

			mockTodoService.createRecurring.mockRejectedValue(
				new Error("투두 생성 실패"),
			);

			// When & Then: 에러가 전파되어야 한다
			await expect(
				service.handleAction(
					mockUserId,
					1,
					{ action: "accept", categoryId: 5 },
					"Asia/Seoul",
				),
			).rejects.toThrow("투두 생성 실패");

			// Then -상태가 ACCEPTED → PENDING으로 롤백되어야 한다
			expect(mockRepository.updateStatus).toHaveBeenCalledTimes(2);
			expect(mockRepository.updateStatus).toHaveBeenNthCalledWith(
				1,
				1,
				"ACCEPTED",
			);
			expect(mockRepository.updateStatus).toHaveBeenNthCalledWith(
				2,
				1,
				"PENDING",
			);
		});

		it("수락 시 투두 생성 실패 후 롤백도 실패하면 원본 에러가 전파되어야 한다", async () => {
			// Given -PENDING 상태의 제안, 투두 생성 실패 + 롤백 실패
			const suggestion = createMockSuggestionEntity();
			mockRepository.findByIdAndUserId.mockResolvedValue(suggestion);

			mockRepository.updateStatus
				.mockResolvedValueOnce(
					createMockSuggestionEntity({ status: "ACCEPTED" }),
				)
				.mockRejectedValueOnce(new Error("DB 연결 끊김"));

			mockTodoService.createRecurring.mockRejectedValue(
				new Error("투두 생성 실패"),
			);

			// When & Then: 롤백 실패와 무관하게 원본 에러("투두 생성 실패")가 전파되어야 한다
			await expect(
				service.handleAction(
					mockUserId,
					1,
					{ action: "accept", categoryId: 5 },
					"Asia/Seoul",
				),
			).rejects.toThrow("투두 생성 실패");

			// Then -롤백 시도는 되어야 한다
			expect(mockRepository.updateStatus).toHaveBeenNthCalledWith(
				2,
				1,
				"PENDING",
			);
		});
	});

	// =========================================================================
	// analyzeAndCreateSuggestions
	// =========================================================================

	describe("analyzeAndCreateSuggestions", () => {
		it("할 일이 최소 횟수 미만이면 AI 호출 없이 0을 반환해야 한다", async () => {
			// Given -할 일이 2개뿐 (최소 3개 필요)
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

			// When -analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(
				mockUserId,
				"Asia/Seoul",
			);

			// Then -AI가 호출되지 않고 0을 반환해야 한다
			expect(result).toBe(0);
			expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
		});

		it("패턴 감지 시 기존 PENDING 제안을 삭제하고 새 제안을 생성해야 한다", async () => {
			// Given -충분한 할 일과 AI 패턴 감지 결과
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

			// When -analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(
				mockUserId,
				"Asia/Seoul",
			);

			// Then -기존 PENDING 삭제 후 새 제안이 일괄 생성되어야 한다
			expect(mockRepository.deletePending.mock.calls[0]?.[0]).toBe(mockUserId);
			expect(mockRepository.deleteExpired.mock.calls[0]?.[0]).toBe(mockUserId);
			expect(result).toBe(1);
			expect(mockRepository.createMany).toHaveBeenCalledTimes(1);
		});

		it("deletePending이 deleteExpired보다 먼저 호출되어야 한다", async () => {
			// Given -패턴이 감지되는 상황
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

			// When -analyzeAndCreateSuggestions를 호출하면
			await service.analyzeAndCreateSuggestions(mockUserId, "Asia/Seoul");

			// Then -deletePending이 deleteExpired보다 먼저 호출되어야 한다
			const deletePendingOrder =
				mockRepository.deletePending.mock.invocationCallOrder[0];
			const deleteExpiredOrder =
				mockRepository.deleteExpired.mock.invocationCallOrder[0];
			expect(deletePendingOrder).toBeLessThan(deleteExpiredOrder as number);
		});

		it("제안 교체 로직은 트랜잭션 내에서 실행되어야 한다", async () => {
			// Given -패턴이 감지되는 상황
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

			// When -analyzeAndCreateSuggestions를 호출하면
			await service.analyzeAndCreateSuggestions(mockUserId, "Asia/Seoul");

			// Then -$transaction이 호출되어야 한다
			expect(mockDatabase.$transaction).toHaveBeenCalledTimes(1);
		});

		it("createMany 에러 발생 시 트랜잭션이 롤백되어야 한다", async () => {
			// Given -패턴 감지, createMany에서 에러
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

			// $transaction이 에러를 전파하도록 설정
			mockDatabase.$transaction.mockImplementation(async (callback) => {
				return callback(mockRepository as never);
			});

			// When & Then: 에러가 전파되어야 한다
			await expect(
				service.analyzeAndCreateSuggestions(mockUserId, "Asia/Seoul"),
			).rejects.toThrow("DB 에러");
		});

		it("최대 5개까지만 생성해야 한다", async () => {
			// Given -6개의 패턴이 감지된 상황
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

			// When -analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(
				mockUserId,
				"Asia/Seoul",
			);

			// Then -최대 5개만 생성되어야 한다
			expect(result).toBe(5);
			const createManyArg = mockRepository.createMany.mock
				.calls[0]?.[0] as unknown[];
			expect(createManyArg).toHaveLength(5);
		});

		it("매칭된 투두의 최빈 카테고리를 suggestedCategoryId로 설정해야 한다", async () => {
			// Given -같은 제목의 투두가 다른 카테고리에 분포 (categoryId 3이 3개, 5가 2개)
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

			// When -analyzeAndCreateSuggestions를 호출하면
			await service.analyzeAndCreateSuggestions(mockUserId, "Asia/Seoul");

			// Then -최빈 카테고리(3)가 suggestedCategoryId로 설정되어야 한다
			const createManyArg = mockRepository.createMany.mock
				.calls[0]?.[0] as Record<string, unknown>[];
			expect(createManyArg?.[0]?.suggestedCategoryId).toBe(3);
		});

		it("매칭되는 투두가 없으면 suggestedCategoryId가 null이어야 한다", async () => {
			// Given -투두 제목과 패턴 matchedTitles가 일치하지 않는 상황
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

			// When -analyzeAndCreateSuggestions를 호출하면
			await service.analyzeAndCreateSuggestions(mockUserId, "Asia/Seoul");

			// Then -suggestedCategoryId가 null이어야 한다
			const createManyArg = mockRepository.createMany.mock
				.calls[0]?.[0] as Record<string, unknown>[];
			expect(createManyArg?.[0]?.suggestedCategoryId).toBeNull();
		});

		it("시즌 추천(빈 matchedTitles)은 필터를 통과해야 한다", async () => {
			// Given -충분한 할 일과 빈 matchedTitles를 가진 시즌 추천 패턴
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

			// When -analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(
				mockUserId,
				"Asia/Seoul",
			);

			// Then -시즌 추천이 필터를 통과하여 생성되어야 한다
			expect(result).toBe(1);
			expect(mockRepository.createMany).toHaveBeenCalledTimes(1);
		});

		it("날씨 컨텍스트 없을 때 날씨 관련 제안은 필터링되어야 한다", async () => {
			// Given -날씨 컨텍스트가 없고 날씨 관련 키워드가 포함된 패턴
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

			// When -analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(
				mockUserId,
				"Asia/Seoul",
			);

			// Then -날씨 관련 제안이 필터링되어 0을 반환해야 한다
			expect(result).toBe(0);
			expect(mockRepository.createMany).not.toHaveBeenCalled();
		});

		it("날씨 컨텍스트 있을 때 날씨 관련 제안은 유지되어야 한다", async () => {
			// Given -날씨 컨텍스트가 있고 날씨 관련 키워드가 포함된 패턴
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

			// When -analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(
				mockUserId,
				"Asia/Seoul",
			);

			// Then -날씨 관련 제안이 유지되어 생성되어야 한다
			expect(result).toBe(1);
			expect(mockRepository.createMany).toHaveBeenCalledTimes(1);
		});
	});
});
