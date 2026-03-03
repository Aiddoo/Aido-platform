/**
 * AI 반복 제안 매퍼
 *
 * Prisma RecurringSuggestion 엔티티를 응답 DTO로 변환하는 Static 메서드를 제공합니다.
 */

import type { RecurringSuggestion } from "@aido/validators";
import { dayOfWeekSchema } from "@aido/validators";
import { z } from "zod";
import type { RecurringSuggestion as RecurringSuggestionEntity } from "@/generated/prisma/client";

/**
 * AI 반복 제안 매퍼 클래스
 *
 * Prisma 엔티티를 API 응답 형식으로 변환합니다.
 */
export abstract class AiSuggestionMapper {
	/**
	 * Prisma RecurringSuggestion 엔티티를 API 응답 형식으로 변환
	 */
	static toResponse(entity: RecurringSuggestionEntity): RecurringSuggestion {
		const daysResult = z.array(dayOfWeekSchema).safeParse(entity.daysOfWeek);

		return {
			id: entity.id,
			title: entity.title,
			daysOfWeek: daysResult.success ? daysResult.data : [],
			scheduledTime: entity.scheduledTime,
			confidence: entity.confidence,
			reason: entity.reason,
			status: entity.status as "PENDING" | "ACCEPTED" | "DISMISSED",
			expiresAt: entity.expiresAt.toISOString(),
			createdAt: entity.createdAt.toISOString(),
		};
	}

	/**
	 * 여러 엔티티를 API 응답 형식으로 일괄 변환
	 */
	static toManyResponse(
		entities: RecurringSuggestionEntity[],
	): RecurringSuggestion[] {
		return entities.map((entity) => AiSuggestionMapper.toResponse(entity));
	}
}
