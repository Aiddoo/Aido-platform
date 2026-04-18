/**
 * AI Router Provider
 *
 * `modelHint`에 따라 적절한 실제 Provider로 위임합니다.
 *
 * - `modelHint === "report"` & Anthropic 가용: Claude Sonnet 4.6
 * - 그 외 (기본값, Anthropic 미가용 포함): Gemini 2.5 Flash
 *
 * 운영 환경에 `ANTHROPIC_API_KEY`가 없어도 기능이 깨지지 않도록,
 * Anthropic이 비가용이면 조용히 Gemini로 fallback 합니다.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";

import type {
	AiProvider,
	GenerateStructuredOptions,
	GenerateStructuredResult,
} from "./ai.provider";
import { AnthropicProvider } from "./anthropic.provider";
import { GeminiProvider } from "./gemini.provider";

export const AI_PROVIDER_GEMINI = Symbol("AI_PROVIDER_GEMINI");
export const AI_PROVIDER_ANTHROPIC = Symbol("AI_PROVIDER_ANTHROPIC");

@Injectable()
export class AiRouterProvider implements AiProvider {
	readonly #logger = new Logger(AiRouterProvider.name);

	constructor(
		@Inject(AI_PROVIDER_GEMINI) private readonly gemini: GeminiProvider,
		@Inject(AI_PROVIDER_ANTHROPIC)
		private readonly anthropic: AnthropicProvider,
	) {}

	async generateStructured<T>(
		options: GenerateStructuredOptions<T>,
	): Promise<GenerateStructuredResult<T>> {
		const target = this.#selectProvider(options.modelHint);
		return target.generateStructured(options);
	}

	isAvailable(): boolean {
		return this.gemini.isAvailable() || this.anthropic.isAvailable();
	}

	#selectProvider(
		hint: GenerateStructuredOptions<unknown>["modelHint"],
	): AiProvider {
		if (hint === "report") {
			if (this.anthropic.isAvailable()) return this.anthropic;
			this.#logger.debug(
				"Anthropic 미가용 — report 요청을 Gemini로 fallback 합니다.",
			);
		}
		return this.gemini;
	}
}
