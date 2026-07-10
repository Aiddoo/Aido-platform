/**
 * AiSuggestionController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조 명확화
 */

import type {
	RecurringSuggestion,
	SuggestionActionResponse,
} from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/decorators";

import { AiSuggestionController } from "./ai-suggestion.controller";
import { AiSuggestionService } from "./ai-suggestion.service";

describe("AiSuggestionController — AI 제안 컨트롤러", () => {
	let controller: AiSuggestionController;
	let mockService: Mocked<AiSuggestionService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			AiSuggestionController,
		).compile();

		controller = unit;
		mockService = unitRef.get(AiSuggestionService);
	});

	describe("getPendingSuggestions", () => {
		it("대기 중인 제안 목록 조회를 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -서비스에서 빈 제안 목록을 반환하도록 설정
			const mockSuggestions: RecurringSuggestion[] = [];
			mockService.getPendingSuggestions.mockResolvedValue(mockSuggestions);

			// When -getPendingSuggestions를 호출하면
			const result = await controller.getPendingSuggestions(mockUser);

			// Then -서비스에 올바른 파라미터를 전달하고 응답을 반환해야 한다
			expect(mockService.getPendingSuggestions).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({ suggestions: mockSuggestions });
		});

		it("여러 제안이 있는 목록을 반환해야 한다", async () => {
			// Given -서비스에서 2개의 제안을 반환
			const mockSuggestions: RecurringSuggestion[] = [
				{
					id: 1,
					title: "팀 미팅",
					daysOfWeek: ["MON", "WED", "FRI"],
					scheduledTime: "10:00",
					confidence: 0.85,
					reason: "이유",
					status: "PENDING",
					expiresAt: "2026-03-18T00:00:00.000Z",
					createdAt: "2026-03-04T00:00:00.000Z",
					suggestedCategoryId: 3,
				},
			];
			mockService.getPendingSuggestions.mockResolvedValue(mockSuggestions);

			// When -getPendingSuggestions를 호출하면
			const result = await controller.getPendingSuggestions(mockUser);

			// Then -제안 목록을 반환해야 한다
			expect(result.suggestions).toHaveLength(1);
		});
	});

	describe("handleSuggestion", () => {
		it("제안 수락을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -서비스에서 수락 결과를 반환하도록 설정
			const params = { id: 1 };
			const body = { action: "accept" as const, categoryId: 1 };
			const tz = "Asia/Seoul";
			const mockResult: SuggestionActionResponse = {
				message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
				suggestion: {
					id: 1,
					title: "팀 미팅",
					daysOfWeek: ["MON"],
					scheduledTime: "10:00",
					confidence: 0.85,
					reason: "이유",
					status: "ACCEPTED",
					expiresAt: "2026-03-18T00:00:00.000Z",
					createdAt: "2026-03-04T00:00:00.000Z",
					suggestedCategoryId: 3,
				},
				createdTodosCount: 4,
			};
			mockService.handleAction.mockResolvedValue(mockResult);

			// When -handleSuggestion을 호출하면
			const result = await controller.handleSuggestion(
				mockUser,
				params as never,
				body as never,
				tz,
			);

			// Then -서비스에 올바른 파라미터를 전달하고 응답을 반환해야 한다
			expect(mockService.handleAction).toHaveBeenCalledWith(
				mockUser.userId,
				params.id,
				body,
				tz,
			);
			expect(result).toEqual(mockResult);
		});

		it("제안 거절을 서비스에 위임하고 결과를 반환해야 한다", async () => {
			// Given -서비스에서 거절 결과를 반환하도록 설정
			const params = { id: 2 };
			const body = { action: "dismiss" as const };
			const tz = "Asia/Seoul";
			const mockResult: SuggestionActionResponse = {
				message: "제안이 거절되었습니다.",
				suggestion: {
					id: 2,
					title: "운동",
					daysOfWeek: ["TUE", "THU"],
					scheduledTime: null,
					confidence: 0.7,
					reason: "이유",
					status: "DISMISSED",
					expiresAt: "2026-03-18T00:00:00.000Z",
					createdAt: "2026-03-04T00:00:00.000Z",
					suggestedCategoryId: null,
				},
			};
			mockService.handleAction.mockResolvedValue(mockResult);

			// When -handleSuggestion을 호출하면
			const result = await controller.handleSuggestion(
				mockUser,
				params as never,
				body as never,
				tz,
			);

			// Then -서비스에 올바른 파라미터를 전달하고 응답을 반환해야 한다
			expect(mockService.handleAction).toHaveBeenCalledWith(
				mockUser.userId,
				params.id,
				body,
				tz,
			);
			expect(result).toEqual(mockResult);
		});
	});
});
