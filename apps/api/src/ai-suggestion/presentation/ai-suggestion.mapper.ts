/**
 * AI 반복 제안 매퍼
 *
 * Suggestion 도메인 애그리게잇을 응답 DTO로 변환하는 Static 메서드를 제공합니다.
 */

import type {
	RecurringSuggestion,
	SuggestionActionResponse,
} from "@aido/validators";
import { dayOfWeekSchema } from "@aido/validators";
import { z } from "zod";

import type { SuggestionActionResult } from "../application/use-cases/handle-suggestion-action/handle-suggestion-action.use-case";
import type { Suggestion } from "../domain/entities/suggestion.entity";

/**
 * AI 반복 제안 매퍼 클래스
 *
 * Suggestion 애그리게잇을 API 응답 형식으로 변환합니다.
 */
export abstract class AiSuggestionMapper {
	/**
	 * Suggestion 애그리게잇을 API 응답 형식으로 변환
	 */
	static toResponse(suggestion: Suggestion): RecurringSuggestion {
		const daysResult = z
			.array(dayOfWeekSchema)
			.safeParse(suggestion.daysOfWeek);

		return {
			id: suggestion.id,
			title: suggestion.title,
			daysOfWeek: daysResult.success ? daysResult.data : [],
			scheduledTime: suggestion.scheduledTime,
			confidence: suggestion.confidence,
			reason: suggestion.reason,
			status: suggestion.status,
			expiresAt: suggestion.expiresAt.toISOString(),
			createdAt: suggestion.createdAt.toISOString(),
			suggestedCategoryId: suggestion.suggestedCategoryId ?? null,
		};
	}

	/**
	 * 여러 애그리게잇을 API 응답 형식으로 일괄 변환
	 */
	static toManyResponse(suggestions: Suggestion[]): RecurringSuggestion[] {
		return suggestions.map((suggestion) =>
			AiSuggestionMapper.toResponse(suggestion),
		);
	}

	/**
	 * 수락/거절 결과를 API 응답 형식으로 변환 (createdTodosCount는 수락 시에만 포함)
	 */
	static toActionResponse(
		result: SuggestionActionResult,
	): SuggestionActionResponse {
		return {
			message: result.message,
			suggestion: AiSuggestionMapper.toResponse(result.suggestion),
			...(result.createdTodosCount !== undefined && {
				createdTodosCount: result.createdTodosCount,
			}),
		};
	}
}
