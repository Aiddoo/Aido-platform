/**
 * AiSuggestionMapper 단위 테스트
 *
 * GWT 패턴 적용
 * - Suggestion 애그리게잇 → DTO 변환 검증
 * - 여러 애그리게잇 일괄 변환 검증
 * - 수락/거절 결과 변환 검증
 */

import {
	Suggestion,
	type SuggestionProps,
} from "../domain/entities/suggestion.entity";
import { AiSuggestionMapper } from "./ai-suggestion.mapper";

function createSuggestion(overrides?: Partial<SuggestionProps>): Suggestion {
	return Suggestion.reconstitute({
		id: 1,
		userId: "user-123",
		title: "팀 미팅",
		daysOfWeek: ["MON", "WED", "FRI"],
		scheduledTime: "10:00",
		confidence: 0.85,
		reason: "매주 월/수/금에 반복되는 패턴이 감지되었습니다.",
		matchedTodos: ["팀 미팅", "팀 회의"],
		status: "PENDING",
		suggestedCategoryId: 3,
		expiresAt: new Date("2026-03-18T00:00:00.000Z"),
		createdAt: new Date("2026-03-04T00:00:00.000Z"),
		updatedAt: new Date("2026-03-04T00:00:00.000Z"),
		...overrides,
	});
}

describe("AiSuggestionMapper — AI 제안 매퍼", () => {
	describe("toResponse", () => {
		it("Suggestion 애그리게잇을 올바른 DTO 형식으로 변환해야 한다", () => {
			// Given -Suggestion 애그리게잇
			const suggestion = createSuggestion();

			// When -toResponse를 호출하면
			const result = AiSuggestionMapper.toResponse(suggestion);

			// Then -DTO 형식으로 변환되어야 한다
			expect(result.id).toBe(1);
			expect(result.title).toBe("팀 미팅");
			expect(result.daysOfWeek).toEqual(["MON", "WED", "FRI"]);
			expect(result.scheduledTime).toBe("10:00");
			expect(result.confidence).toBe(0.85);
			expect(result.reason).toBe(
				"매주 월/수/금에 반복되는 패턴이 감지되었습니다.",
			);
			expect(result.status).toBe("PENDING");
			expect(result.expiresAt).toBe("2026-03-18T00:00:00.000Z");
			expect(result.createdAt).toBe("2026-03-04T00:00:00.000Z");
			expect(result.suggestedCategoryId).toBe(3);
		});

		it("suggestedCategoryId가 null인 엔티티를 올바르게 변환해야 한다", () => {
			// Given -suggestedCategoryId가 null인 엔티티
			const suggestion = createSuggestion({
				id: 3,
				title: "독서",
				daysOfWeek: ["SAT"],
				scheduledTime: null,
				confidence: 0.7,
				reason: "토요일에 독서 패턴이 감지되었습니다.",
				matchedTodos: ["독서"],
				suggestedCategoryId: null,
			});

			// When -toResponse를 호출하면
			const result = AiSuggestionMapper.toResponse(suggestion);

			// Then -suggestedCategoryId가 null이어야 한다
			expect(result.suggestedCategoryId).toBeNull();
		});

		it("유효하지 않은 daysOfWeek는 빈 배열로 변환해야 한다", () => {
			// Given -daysOfWeek가 유효하지 않은 값
			const suggestion = createSuggestion({ daysOfWeek: "invalid" });

			// When -toResponse를 호출하면
			const result = AiSuggestionMapper.toResponse(suggestion);

			// Then -빈 배열로 변환되어야 한다
			expect(result.daysOfWeek).toEqual([]);
		});
	});

	describe("toManyResponse", () => {
		it("여러 애그리게잇을 일괄 변환해야 한다", () => {
			// Given -2개의 애그리게잇
			const suggestions = [
				createSuggestion({ id: 1 }),
				createSuggestion({ id: 2, suggestedCategoryId: null }),
			];

			// When -toManyResponse를 호출하면
			const result = AiSuggestionMapper.toManyResponse(suggestions);

			// Then -2개의 DTO를 반환해야 한다
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe(1);
			expect(result[1]?.id).toBe(2);
		});

		it("빈 배열이면 빈 배열을 반환해야 한다", () => {
			// When -toManyResponse를 호출하면
			const result = AiSuggestionMapper.toManyResponse([]);

			// Then -빈 배열을 반환해야 한다
			expect(result).toEqual([]);
		});
	});

	describe("toActionResponse", () => {
		it("수락 결과는 createdTodosCount를 포함해야 한다", () => {
			// Given -수락 결과
			const result = AiSuggestionMapper.toActionResponse({
				message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
				suggestion: createSuggestion({ status: "ACCEPTED" }),
				createdTodosCount: 12,
			});

			// Then -createdTodosCount 포함
			expect(result.message).toBe(
				"제안이 수락되어 반복 할 일이 생성되었습니다.",
			);
			expect(result.suggestion.status).toBe("ACCEPTED");
			expect(result.createdTodosCount).toBe(12);
		});

		it("거절 결과는 createdTodosCount를 포함하지 않아야 한다", () => {
			// Given -거절 결과
			const result = AiSuggestionMapper.toActionResponse({
				message: "제안이 거절되었습니다.",
				suggestion: createSuggestion({ status: "DISMISSED" }),
			});

			// Then -createdTodosCount 없음
			expect(result.suggestion.status).toBe("DISMISSED");
			expect(result.createdTodosCount).toBeUndefined();
		});
	});
});
