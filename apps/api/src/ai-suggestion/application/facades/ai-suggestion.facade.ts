import { Injectable } from "@nestjs/common";

import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { GridInput } from "@/weather";

import type { Suggestion } from "../../domain/entities/suggestion.entity";
import { AnalyzeAndCreateSuggestionsUseCase } from "../use-cases/analyze-and-create-suggestions/analyze-and-create-suggestions.use-case";
import { GetPendingSuggestionsUseCase } from "../use-cases/get-pending-suggestions/get-pending-suggestions.use-case";
import {
	type HandleSuggestionActionInput,
	HandleSuggestionActionUseCase,
	type SuggestionActionResult,
} from "../use-cases/handle-suggestion-action/handle-suggestion-action.use-case";

/**
 * AI 반복 제안 파사드.
 *
 * 컨트롤러·프로세서의 유일한 주입 대상. use-case 클래스를 직접 주입해 위임한다(버스 없음).
 */
@Injectable()
export class AiSuggestionFacade {
	constructor(
		private readonly getPendingSuggestionsUseCase: GetPendingSuggestionsUseCase,
		private readonly handleSuggestionActionUseCase: HandleSuggestionActionUseCase,
		private readonly analyzeAndCreateSuggestionsUseCase: AnalyzeAndCreateSuggestionsUseCase,
	) {}

	getPendingSuggestions(userId: string): Promise<Suggestion[]> {
		return this.getPendingSuggestionsUseCase.execute(userId);
	}

	handleAction(
		input: HandleSuggestionActionInput,
	): Promise<SuggestionActionResult> {
		return this.handleSuggestionActionUseCase.execute(input);
	}

	analyzeAndCreateSuggestions(
		userId: string,
		timezone: string,
		weatherGrid?: GridInput | null,
		locale: SupportedLocale = "ko",
	): Promise<number> {
		return this.analyzeAndCreateSuggestionsUseCase.execute(
			userId,
			timezone,
			weatherGrid,
			locale,
		);
	}
}
