/**
 * AiSuggestionMapper 단위 테스트
 *
 * GWT 패턴 적용
 * - Entity → DTO 변환 검증
 * - 여러 엔티티 일괄 변환 검증
 */

import type { RecurringSuggestion } from "@/generated/prisma/client";

import { AiSuggestionMapper } from "./ai-suggestion.mapper";

describe("AiSuggestionMapper", () => {
	// =========================================================================
	// toResponse
	// =========================================================================

	describe("toResponse", () => {
		it("Prisma 엔티티를 올바른 DTO 형식으로 변환해야 한다", () => {
			// Given -Prisma RecurringSuggestion 엔티티
			const entity = {
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
			} as RecurringSuggestion;

			// When -toResponse를 호출하면
			const result = AiSuggestionMapper.toResponse(entity);

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
			const entity = {
				id: 3,
				userId: "user-123",
				title: "독서",
				daysOfWeek: ["SAT"],
				scheduledTime: null,
				confidence: 0.7,
				reason: "토요일에 독서 패턴이 감지되었습니다.",
				matchedTodos: ["독서"],
				status: "PENDING",
				suggestedCategoryId: null,
				expiresAt: new Date("2026-03-18T00:00:00.000Z"),
				createdAt: new Date("2026-03-04T00:00:00.000Z"),
				updatedAt: new Date("2026-03-04T00:00:00.000Z"),
			} as RecurringSuggestion;

			// When -toResponse를 호출하면
			const result = AiSuggestionMapper.toResponse(entity);

			// Then -suggestedCategoryId가 null이어야 한다
			expect(result.suggestedCategoryId).toBeNull();
		});

		it("scheduledTime이 null인 엔티티를 올바르게 변환해야 한다", () => {
			// Given -scheduledTime이 null인 엔티티
			const entity = {
				id: 2,
				userId: "user-123",
				title: "운동",
				daysOfWeek: ["TUE", "THU"],
				scheduledTime: null,
				confidence: 0.7,
				reason: "화/목에 운동 패턴이 감지되었습니다.",
				matchedTodos: ["운동"],
				status: "PENDING",
				expiresAt: new Date("2026-03-18T00:00:00.000Z"),
				createdAt: new Date("2026-03-04T00:00:00.000Z"),
				updatedAt: new Date("2026-03-04T00:00:00.000Z"),
			} as RecurringSuggestion;

			// When -toResponse를 호출하면
			const result = AiSuggestionMapper.toResponse(entity);

			// Then -scheduledTime이 null이어야 한다
			expect(result.scheduledTime).toBeNull();
		});
	});

	// =========================================================================
	// toManyResponse
	// =========================================================================

	describe("toManyResponse", () => {
		it("여러 엔티티를 일괄 변환해야 한다", () => {
			// Given -2개의 엔티티
			const entities = [
				{
					id: 1,
					userId: "user-123",
					title: "팀 미팅",
					daysOfWeek: ["MON"],
					scheduledTime: "10:00",
					confidence: 0.85,
					reason: "이유1",
					matchedTodos: [],
					status: "PENDING",
					suggestedCategoryId: 3,
					expiresAt: new Date("2026-03-18T00:00:00.000Z"),
					createdAt: new Date("2026-03-04T00:00:00.000Z"),
					updatedAt: new Date("2026-03-04T00:00:00.000Z"),
				},
				{
					id: 2,
					userId: "user-123",
					title: "운동",
					daysOfWeek: ["TUE", "THU"],
					scheduledTime: null,
					confidence: 0.7,
					reason: "이유2",
					matchedTodos: [],
					status: "PENDING",
					suggestedCategoryId: null,
					expiresAt: new Date("2026-03-18T00:00:00.000Z"),
					createdAt: new Date("2026-03-04T00:00:00.000Z"),
					updatedAt: new Date("2026-03-04T00:00:00.000Z"),
				},
			] as RecurringSuggestion[];

			// When -toManyResponse를 호출하면
			const result = AiSuggestionMapper.toManyResponse(entities);

			// Then -2개의 DTO를 반환해야 한다
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe(1);
			expect(result[1]?.id).toBe(2);
		});

		it("빈 배열이면 빈 배열을 반환해야 한다", () => {
			// Given -빈 배열

			// When -toManyResponse를 호출하면
			const result = AiSuggestionMapper.toManyResponse([]);

			// Then -빈 배열을 반환해야 한다
			expect(result).toEqual([]);
		});
	});
});
