/**
 * Anthropic Claude Provider
 *
 * Vercel AI SDK를 사용하여 Anthropic Claude Sonnet 4.6 모델과 통신합니다.
 * 사용자 전담 코치 톤이 중요한 주간/월간 리포트 등 품질 민감 경로 전용입니다.
 *
 * 가격 (2026년 4월 기준):
 * - Input: $3 / 1M tokens
 * - Output: $15 / 1M tokens
 * 프리미엄 전용·저빈도 호출(유저당 월 1~4회)이므로 비용 영향 미미.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APICallError, generateObject } from "ai";
import type { z } from "zod";

import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

import type {
	AiProvider,
	GenerateStructuredOptions,
	GenerateStructuredResult,
} from "./ai.provider";

const ANTHROPIC_MODEL = "claude-sonnet-4-6" as const;
const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_TEMPERATURE = 0.5;
const API_TIMEOUT_MS = 60_000;

@Injectable()
export class AnthropicProvider implements AiProvider {
	readonly #model: ReturnType<ReturnType<typeof createAnthropic>>;
	readonly #available: boolean;

	constructor(private readonly configService: ConfigService) {
		const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");
		this.#available = !!apiKey;
		this.#model = apiKey
			? createAnthropic({ apiKey })(ANTHROPIC_MODEL)
			: (undefined as never);
	}

	async generateStructured<T>(
		options: GenerateStructuredOptions<T>,
	): Promise<GenerateStructuredResult<T>> {
		if (!this.#available) {
			throw BusinessExceptions.aiServiceUnavailable();
		}

		try {
			const { object, usage } = await generateObject({
				model: this.#model,
				...(options.system && { system: options.system }),
				prompt: options.prompt,
				schema: options.schema as z.ZodType<T>,
				maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
				temperature: options.temperature ?? DEFAULT_TEMPERATURE,
				abortSignal: AbortSignal.timeout(API_TIMEOUT_MS),
			});

			return {
				output: object,
				model: `anthropic:${ANTHROPIC_MODEL}`,
				usage: {
					input: usage.inputTokens ?? 0,
					output: usage.outputTokens ?? 0,
				},
			};
		} catch (error) {
			if (APICallError.isInstance(error) && error.statusCode === 429) {
				throw BusinessExceptions.aiRateLimitExceeded();
			}
			throw error;
		}
	}

	isAvailable(): boolean {
		return this.#available;
	}
}
