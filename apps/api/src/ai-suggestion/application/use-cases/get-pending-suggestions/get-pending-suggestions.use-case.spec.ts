/**
 * GetPendingSuggestionsUseCase 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 프리미엄 게이트 + 목록 조회 위임
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { Suggestion } from "../../../domain/entities/suggestion.aggregate";
import {
	AI_SUGGESTION_REPOSITORY,
	type AiSuggestionRepositoryPort,
} from "../../ports/ai-suggestion.repository.port";
import { GetPendingSuggestionsUseCase } from "./get-pending-suggestions.use-case";

const mockUserId = "user-123";

function createSuggestion(): Suggestion {
	return Suggestion.reconstitute({
		id: 1,
		userId: mockUserId,
		title: "팀 미팅",
		daysOfWeek: ["MON", "WED", "FRI"],
		scheduledTime: "10:00",
		confidence: 0.85,
		reason: "이유",
		matchedTodos: [],
		status: "PENDING",
		suggestedCategoryId: 3,
		expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
		createdAt: new Date("2026-03-04T00:00:00.000Z"),
		updatedAt: new Date("2026-03-04T00:00:00.000Z"),
	});
}

describe("GetPendingSuggestionsUseCase", () => {
	let useCase: GetPendingSuggestionsUseCase;
	let repo: Mocked<AiSuggestionRepositoryPort>;
	let entitlement: Mocked<EntitlementService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetPendingSuggestionsUseCase).compile();

		useCase = unit;
		repo = unitRef.get(AI_SUGGESTION_REPOSITORY);
		entitlement = unitRef.get(EntitlementService);

		entitlement.hasPremiumAccess.mockResolvedValue(true);
	});

	it("비프리미엄 사용자면 AI_1309 예외를 던지고 조회하지 않아야 한다", async () => {
		entitlement.hasPremiumAccess.mockResolvedValue(false);

		await expect(useCase.execute(mockUserId)).rejects.toBeInstanceOf(ApplicationException);
		expect(repo.findPendingByUserId).not.toHaveBeenCalled();
	});

	it("프리미엄 사용자면 대기 중인 제안 목록을 반환해야 한다", async () => {
		repo.findPendingByUserId.mockResolvedValue([createSuggestion()]);

		const result = await useCase.execute(mockUserId);

		expect(repo.findPendingByUserId).toHaveBeenCalledWith(mockUserId);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe(1);
	});
});
