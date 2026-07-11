/**
 * AI Router Provider
 *
 * `modelHint`에 따라 실제 Provider로 위임하는 라우팅 레이어.
 * 현재는 Gemini 2.5 Flash-Lite 단일 Provider만 사용하지만, 향후 경로별 모델
 * 분기를 쉽게 추가할 수 있도록 라우터 구조를 유지합니다.
 */
import { Inject, Injectable } from "@nestjs/common";

import type {
	AiProvider,
	GenerateStructuredOptions,
	GenerateStructuredResult,
} from "../../application/ports/ai-provider.port";
import { GeminiAiAdapter } from "./gemini-ai.adapter";

export const AI_PROVIDER_GEMINI = Symbol("AI_PROVIDER_GEMINI");

@Injectable()
export class AiRouterAdapter implements AiProvider {
	constructor(
		@Inject(AI_PROVIDER_GEMINI) private readonly gemini: GeminiAiAdapter,
	) {}

	async generateStructured<T>(
		options: GenerateStructuredOptions<T>,
	): Promise<GenerateStructuredResult<T>> {
		return this.#selectProvider(options.modelHint).generateStructured(options);
	}

	isAvailable(): boolean {
		return this.gemini.isAvailable();
	}

	#selectProvider(
		_hint: GenerateStructuredOptions<unknown>["modelHint"],
	): AiProvider {
		return this.gemini;
	}
}
