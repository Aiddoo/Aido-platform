/**
 * AiSuggestionService 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - handleAction: 다양한 에러 케이스 및 정상 플로우 검증
 * - analyzeAndCreateSuggestions: 분석 로직 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import type { RecurringSuggestion } from "@/generated/prisma/client";

import type { AiProvider } from "../ai/providers/ai.provider";
import { AI_PROVIDER } from "../ai/providers/ai.provider";
import { TodoService } from "../todo/todo.service";
import { AiSuggestionRepository } from "./ai-suggestion.repository";
import { AiSuggestionService } from "./ai-suggestion.service";

describe("AiSuggestionService", () => {
	let service: AiSuggestionService;
	let mockRepository: Mocked<AiSuggestionRepository>;
	let mockTodoService: Mocked<TodoService>;
	let mockAiProvider: Mocked<AiProvider>;

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
			expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14일 후
			createdAt: new Date("2026-03-04T00:00:00.000Z"),
			updatedAt: new Date("2026-03-04T00:00:00.000Z"),
			...overrides,
		} as RecurringSuggestion;
	}

	beforeEach(async () => {
		jest.clearAllMocks();

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
	});

	// =========================================================================
	// getPendingSuggestions
	// =========================================================================

	describe("getPendingSuggestions", () => {
		it("대기 중인 제안 목록을 DTO로 변환하여 반환해야 한다", async () => {
			// Given: 대기 중인 제안 목록이 존재
			const suggestions = [createMockSuggestionEntity()];
			mockRepository.findPendingByUserId.mockResolvedValue(suggestions);

			// When: getPendingSuggestions를 호출하면
			const result = await service.getPendingSuggestions(mockUserId);

			// Then: DTO로 변환된 목록을 반환해야 한다
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
			// Given: 제안이 존재하지 않음
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
			// Given: 이미 ACCEPTED 상태인 제안
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
			// Given: 만료된 제안
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
			// Given: PENDING 상태의 제안
			const suggestion = createMockSuggestionEntity();
			mockRepository.findByIdAndUserId.mockResolvedValue(suggestion);
			const updatedSuggestion = createMockSuggestionEntity({
				status: "DISMISSED",
			});
			mockRepository.updateStatus.mockResolvedValue(updatedSuggestion);

			// When: dismiss 액션을 수행하면
			const result = await service.handleAction(
				mockUserId,
				1,
				{ action: "dismiss" },
				"Asia/Seoul",
			);

			// Then: DISMISSED로 업데이트되어야 한다
			expect(mockRepository.updateStatus).toHaveBeenCalledWith(1, "DISMISSED");
			expect(result.suggestion.status).toBe("DISMISSED");
			expect(result.message).toContain("거절");
			expect(result.createdTodosCount).toBeUndefined();
			expect(mockTodoService.createRecurring).not.toHaveBeenCalled();
		});

		it("수락 시 TodoService.createRecurring을 호출하고 ACCEPTED로 업데이트해야 한다", async () => {
			// Given: PENDING 상태의 제안과 TodoService 응답
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

			// When: accept 액션을 수행하면
			const result = await service.handleAction(
				mockUserId,
				1,
				{ action: "accept", categoryId: 5 },
				"Asia/Seoul",
			);

			// Then: TodoService.createRecurring이 호출되고 ACCEPTED로 업데이트되어야 한다
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
			expect(mockRepository.updateStatus).toHaveBeenCalledWith(1, "ACCEPTED");
			expect(result.suggestion.status).toBe("ACCEPTED");
			expect(result.createdTodosCount).toBe(12);
		});
	});

	// =========================================================================
	// analyzeAndCreateSuggestions
	// =========================================================================

	describe("analyzeAndCreateSuggestions", () => {
		it("할 일이 최소 횟수 미만이면 AI 호출 없이 0을 반환해야 한다", async () => {
			// Given: 할 일이 2개뿐 (최소 3개 필요)
			mockRepository.findRecentTodos.mockResolvedValue([
				{ title: "할일1", startDate: "2026-03-01", scheduledTime: null },
				{ title: "할일2", startDate: "2026-03-02", scheduledTime: null },
			]);

			// When: analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(mockUserId);

			// Then: AI가 호출되지 않고 0을 반환해야 한다
			expect(result).toBe(0);
			expect(mockAiProvider.generateStructured).not.toHaveBeenCalled();
		});

		it("패턴이 감지되면 새 제안을 생성해야 한다", async () => {
			// Given: 충분한 할 일과 AI 패턴 감지 결과
			const todos = Array.from({ length: 5 }, (_, i) => ({
				title: "팀 미팅",
				startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
				scheduledTime: "10:00",
			}));
			mockRepository.findRecentTodos.mockResolvedValue(todos);

			mockAiProvider.generateStructured.mockResolvedValue({
				output: {
					patterns: [
						{
							title: "팀 미팅",
							daysOfWeek: ["MON", "WED", "FRI"],
							scheduledTime: "10:00",
							confidence: 0.85,
							reason: "반복 패턴",
							matchedTitles: ["팀 미팅"],
						},
					],
				},
				model: "gemini-2.0-flash",
				usage: { input: 100, output: 50 },
			});

			mockRepository.findPendingTitles.mockResolvedValue(new Set());
			mockRepository.deleteExpired.mockResolvedValue({ count: 0 });
			mockRepository.create.mockResolvedValue(createMockSuggestionEntity());

			// When: analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(mockUserId);

			// Then: 새 제안이 생성되어야 한다
			expect(result).toBe(1);
			expect(mockRepository.create).toHaveBeenCalledTimes(1);
			expect(mockRepository.deleteExpired).toHaveBeenCalledWith(mockUserId);
		});

		it("이미 존재하는 제목의 제안은 건너뛰어야 한다", async () => {
			// Given: 이미 존재하는 제목의 제안
			const todos = Array.from({ length: 5 }, (_, i) => ({
				title: "팀 미팅",
				startDate: `2026-02-${String(10 + i).padStart(2, "0")}`,
				scheduledTime: null,
			}));
			mockRepository.findRecentTodos.mockResolvedValue(todos);

			mockAiProvider.generateStructured.mockResolvedValue({
				output: {
					patterns: [
						{
							title: "팀 미팅",
							daysOfWeek: ["MON"],
							scheduledTime: null,
							confidence: 0.8,
							reason: "이유",
							matchedTitles: ["팀 미팅"],
						},
					],
				},
				model: "gemini-2.0-flash",
				usage: { input: 100, output: 50 },
			});

			// 이미 "팀 미팅" 제목의 PENDING 제안이 존재
			mockRepository.findPendingTitles.mockResolvedValue(new Set(["팀 미팅"]));
			mockRepository.deleteExpired.mockResolvedValue({ count: 0 });

			// When: analyzeAndCreateSuggestions를 호출하면
			const result = await service.analyzeAndCreateSuggestions(mockUserId);

			// Then: 중복이므로 생성되지 않아야 한다
			expect(result).toBe(0);
			expect(mockRepository.create).not.toHaveBeenCalled();
		});
	});
});
