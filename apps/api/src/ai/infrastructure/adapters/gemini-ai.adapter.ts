/**
 * Google Gemini Provider
 *
 * Vercel AI SDK로 Gemini 3.1 Flash-Lite와 통신합니다. Stable이고 셧다운 예정이 없습니다.
 *
 * 가격 (2026-08 기준, Developer API Standard / text·image·video, per 1M tokens):
 * | 모델                   | Input | Output |
 * |------------------------|-------|--------|
 * | gemini-2.5-flash-lite  | $0.10 | $0.40  |
 * | **gemini-3.1-flash-lite (현재)** | **$0.25** | **$1.50** |
 * | gemini-3.5-flash-lite  | $0.30 | $2.50  |
 * | gemini-3.6/3.7-flash   | $0.75 | $3.75  |
 *
 * **3.6·3.7 세대에는 Flash-Lite가 없습니다** — Flash뿐이고 현재의 3배이며,
 * 2027-01-01부터 $1.50/$7.50으로 또 오릅니다. 더 싼 것은 한 세대 아래인
 * 2.5-flash-lite뿐이라, 파싱 품질을 세대째 내리는 대가를 치릅니다.
 * 그래서 앞으로도 살아 있는 것 중 가장 싼 3.1-flash-lite를 유지합니다.
 *
 * 출처: https://ai.google.dev/gemini-api/docs/pricing, /docs/deprecations
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APICallError, generateObject } from "ai";

import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";

import type {
	AiProvider,
	GenerateStructuredOptions,
	GenerateStructuredResult,
} from "../../application/ports/ai-provider.port";
import { AiProviderCallError } from "../../application/ports/ai-provider.port";

/** Gemini 모델 설정 */
const GEMINI_MODEL = "gemini-3.1-flash-lite" as const;
const DEFAULT_MAX_OUTPUT_TOKENS = 150;
const API_TIMEOUT_MS = 30_000;

@Injectable()
export class GeminiAiAdapter implements AiProvider {
	readonly #model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>> | null;
	readonly #available: boolean;

	constructor(private readonly configService: ConfigService) {
		const apiKey = this.configService.get<string>("GOOGLE_GENERATIVE_AI_API_KEY");
		// API 키가 있으면 클라이언트와 모델을 한 번만 생성하여 재사용
		this.#model = apiKey ? createGoogleGenerativeAI({ apiKey })(GEMINI_MODEL) : null;
		this.#available = this.#model !== null;
	}

	/**
	 * 구조화된 출력 생성
	 *
	 * Vercel AI SDK의 generateObject를 사용하여
	 * Zod 스키마에 맞는 구조화된 JSON 응답을 생성합니다.
	 */
	async generateStructured<T>(
		options: GenerateStructuredOptions<T>,
	): Promise<GenerateStructuredResult<T>> {
		// available ⟺ 모델 존재. 이 가드로 캐스트 없이 non-null narrowing.
		if (!this.#model) {
			throw BusinessExceptions.aiServiceUnavailable();
		}

		try {
			const { object, usage } = await generateObject({
				model: this.#model,
				// AI SDK v7: system → instructions (내부 포트의 system 필드를 매핑)
				...(options.system && { instructions: options.system }),
				prompt: options.prompt,
				schema: options.schema,
				// v6까지 maxTokens로 잘못 전달되어 조용히 무시되던 latent bug 수정 —
				// 이 상한은 이번에 처음으로 실제 적용된다
				maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
				abortSignal: AbortSignal.timeout(API_TIMEOUT_MS),
			});

			return {
				output: object,
				model: `google:${GEMINI_MODEL}`,
				usage: {
					input: usage.inputTokens ?? 0,
					output: usage.outputTokens ?? 0,
				},
			};
		} catch (error) {
			if (APICallError.isInstance(error) && error.statusCode === 429) {
				throw BusinessExceptions.aiRateLimitExceeded();
			}
			if (APICallError.isInstance(error)) {
				throw new AiProviderCallError(error.message, error.statusCode, {
					cause: error,
				});
			}
			throw error;
		}
	}

	/**
	 * Provider 가용성 확인
	 *
	 * @returns API 키 설정 여부
	 */
	isAvailable(): boolean {
		return this.#available;
	}
}
