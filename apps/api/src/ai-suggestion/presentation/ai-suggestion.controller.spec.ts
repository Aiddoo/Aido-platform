/**
 * AiSuggestionController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Facade 위임 + 매퍼 변환 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/auth/presentation/decorators";

import { AiSuggestionFacade } from "../application/facades/ai-suggestion.facade";
import {
	Suggestion,
	type SuggestionProps,
} from "../domain/entities/suggestion.entity";
import { AiSuggestionController } from "./ai-suggestion.controller";

function createSuggestion(overrides?: Partial<SuggestionProps>): Suggestion {
	return Suggestion.reconstitute({
		id: 1,
		userId: "user-123",
		title: "팀 미팅",
		daysOfWeek: ["MON", "WED", "FRI"],
		scheduledTime: "10:00",
		confidence: 0.85,
		reason: "이유",
		matchedTodos: [],
		status: "PENDING",
		suggestedCategoryId: 3,
		expiresAt: new Date("2026-03-18T00:00:00.000Z"),
		createdAt: new Date("2026-03-04T00:00:00.000Z"),
		updatedAt: new Date("2026-03-04T00:00:00.000Z"),
		...overrides,
	});
}

describe("AiSuggestionController — AI 제안 컨트롤러", () => {
	let controller: AiSuggestionController;
	let mockFacade: Mocked<AiSuggestionFacade>;

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
		mockFacade = unitRef.get(AiSuggestionFacade);
	});

	describe("getPendingSuggestions", () => {
		it("대기 중인 제안 목록 조회를 파사드에 위임하고 DTO로 변환해야 한다", async () => {
			// Given -파사드에서 빈 제안 목록을 반환하도록 설정
			mockFacade.getPendingSuggestions.mockResolvedValue([]);

			// When -getPendingSuggestions를 호출하면
			const result = await controller.getPendingSuggestions(mockUser);

			// Then -파사드에 올바른 파라미터를 전달하고 응답을 반환해야 한다
			expect(mockFacade.getPendingSuggestions).toHaveBeenCalledWith(
				mockUser.userId,
			);
			expect(result).toEqual({ suggestions: [] });
		});

		it("여러 제안이 있는 목록을 DTO로 변환해야 한다", async () => {
			// Given -파사드에서 1개의 제안을 반환
			mockFacade.getPendingSuggestions.mockResolvedValue([createSuggestion()]);

			// When -getPendingSuggestions를 호출하면
			const result = await controller.getPendingSuggestions(mockUser);

			// Then -제안 목록을 반환해야 한다
			expect(result.suggestions).toHaveLength(1);
			expect(result.suggestions[0]?.id).toBe(1);
			expect(result.suggestions[0]?.daysOfWeek).toEqual(["MON", "WED", "FRI"]);
		});
	});

	describe("handleSuggestion", () => {
		it("제안 수락을 파사드에 위임하고 결과를 변환해야 한다", async () => {
			// Given -파사드에서 수락 결과를 반환하도록 설정
			const params = { id: 1 };
			const body = { action: "accept" as const, categoryId: 1 };
			const tz = "Asia/Seoul";
			mockFacade.handleAction.mockResolvedValue({
				message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
				suggestion: createSuggestion({ status: "ACCEPTED" }),
				createdTodosCount: 4,
			});

			// When -handleSuggestion을 호출하면
			const result = await controller.handleSuggestion(
				mockUser,
				params as never,
				body as never,
				tz,
			);

			// Then -파사드에 올바른 입력을 전달하고 응답을 반환해야 한다
			expect(mockFacade.handleAction).toHaveBeenCalledWith({
				userId: mockUser.userId,
				suggestionId: params.id,
				action: "accept",
				categoryId: 1,
				startDate: undefined,
				endDate: undefined,
				timezone: tz,
			});
			expect(result.createdTodosCount).toBe(4);
			expect(result.suggestion.status).toBe("ACCEPTED");
		});

		it("제안 거절을 파사드에 위임하고 결과를 변환해야 한다", async () => {
			// Given -파사드에서 거절 결과를 반환하도록 설정
			const params = { id: 2 };
			const body = { action: "dismiss" as const };
			const tz = "Asia/Seoul";
			mockFacade.handleAction.mockResolvedValue({
				message: "제안이 거절되었습니다.",
				suggestion: createSuggestion({ id: 2, status: "DISMISSED" }),
			});

			// When -handleSuggestion을 호출하면
			const result = await controller.handleSuggestion(
				mockUser,
				params as never,
				body as never,
				tz,
			);

			// Then -파사드에 올바른 입력을 전달하고 응답을 반환해야 한다
			expect(mockFacade.handleAction).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.userId,
					suggestionId: params.id,
					action: "dismiss",
					timezone: tz,
				}),
			);
			expect(result.suggestion.status).toBe("DISMISSED");
			expect(result.createdTodosCount).toBeUndefined();
		});
	});
});
