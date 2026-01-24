/**
 * Google Gemini Provider
 *
 * Vercel AI SDK를 사용하여 Google Gemini 2.0 Flash 모델과 통신합니다.
 * 토큰 비용 최적화를 위해 Flash 모델을 기본으로 사용합니다.
 *
 * 가격 (2026년 1월 기준):
 * - Input: $0.10 / 1M tokens
 * - Output: $0.40 / 1M tokens
 * - 무료 티어: 1,500 RPD, 15 RPM
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateObject } from "ai";
import type { z } from "zod";
import type {
	AiProvider,
	GenerateStructuredOptions,
	GenerateStructuredResult,
} from "./ai.provider";

/** Gemini 모델 설정 */
const GEMINI_MODEL = "gemini-2.0-flash" as const;
const DEFAULT_MAX_TOKENS = 150;
const DEFAULT_TEMPERATURE = 0.1;

@Injectable()
export class GeminiProvider implements AiProvider {
	private readonly apiKey: string | undefined;

	constructor(private readonly configService: ConfigService) {
		this.apiKey = this.configService.get<string>(
			"GOOGLE_GENERATIVE_AI_API_KEY",
		);
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
		if (!this.apiKey) {
			throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
		}

		const google = createGoogleGenerativeAI({
			apiKey: this.apiKey,
		});

		const model = google(GEMINI_MODEL);

		const { object, usage } = await generateObject({
			model,
			prompt: options.prompt,
			schema: options.schema as z.ZodType<T>,
			maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
			temperature: options.temperature ?? DEFAULT_TEMPERATURE,
		});

		return {
			output: object,
			model: `google:${GEMINI_MODEL}`,
			usage: {
				input: usage.inputTokens ?? 0,
				output: usage.outputTokens ?? 0,
			},
		};
	}

	/**
	 * Provider 가용성 확인
	 *
	 * @returns API 키 설정 여부
	 */
	isAvailable(): boolean {
		return !!this.apiKey;
	}
}
