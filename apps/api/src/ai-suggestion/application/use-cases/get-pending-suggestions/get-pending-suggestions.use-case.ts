import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import type { Suggestion } from "../../../domain/entities/suggestion.aggregate";
import {
	AI_SUGGESTION_REPOSITORY,
	type AiSuggestionRepositoryPort,
} from "../../ports/ai-suggestion.repository.port";

/**
 * 대기 중인 제안 목록 조회 use-case.
 *
 * 프리미엄 접근을 강제한 뒤 PENDING·미만료 제안을 조회한다.
 */
@Injectable()
export class GetPendingSuggestionsUseCase {
	readonly #logger = new Logger(GetPendingSuggestionsUseCase.name);

	constructor(
		@Inject(AI_SUGGESTION_REPOSITORY)
		private readonly repository: AiSuggestionRepositoryPort,
		private readonly entitlementService: EntitlementService,
	) {}

	async execute(userId: string): Promise<Suggestion[]> {
		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
		if (!hasPremium) {
			this.#logger.warn(`프리미엄 미구독 접근 차단: userId=${userId}`);
			throw new ApplicationException(ErrorCode.AI_1309);
		}

		return this.repository.findPendingByUserId(userId);
	}
}
