/**
 * AI Provider 추상 인터페이스
 *
 * Vercel AI SDK 패턴을 적용하여 다양한 AI 제공자(Google, OpenAI 등)를
 * 추상화하고 구조화된 출력을 지원합니다.
 */
import type { z } from "zod";

/**
 * 토큰 사용량 정보
 */
export interface TokenUsage {
	/** 입력 토큰 수 */
	input: number;
	/** 출력 토큰 수 */
	output: number;
}

/**
 * 구조화된 생성 옵션
 */
export interface GenerateStructuredOptions<T> {
	/** 프롬프트 텍스트 */
	prompt: string;
	/** 출력 스키마 (Zod) */
	schema: z.ZodSchema<T>;
	/** 최대 출력 토큰 수 */
	maxTokens?: number;
	/** 온도 (0.0 ~ 1.0, 낮을수록 결정적) */
	temperature?: number;
}

/**
 * 구조화된 생성 결과
 */
export interface GenerateStructuredResult<T> {
	/** 파싱된 출력 객체 */
	output: T;
	/** 사용된 모델명 */
	model: string;
	/** 토큰 사용량 */
	usage: TokenUsage;
}

/**
 * AI Provider 인터페이스
 *
 * @example
 * ```typescript
 * const provider: AiProvider = new GeminiProvider(configService);
 * const result = await provider.generateStructured({
 *   prompt: '내일 3시에 회의',
 *   schema: parsedTodoSchema,
 *   maxTokens: 150,
 *   temperature: 0.1,
 * });
 * ```
 */
export interface AiProvider {
	/**
	 * 구조화된 출력 생성
	 *
	 * @param options - 생성 옵션
	 * @returns 구조화된 결과
	 * @throws AI 호출 실패 시 에러
	 */
	generateStructured<T>(
		options: GenerateStructuredOptions<T>,
	): Promise<GenerateStructuredResult<T>>;

	/**
	 * Provider 가용성 확인
	 *
	 * @returns API 키 설정 여부
	 */
	isAvailable(): boolean;
}

/** AI Provider 주입 토큰 */
export const AI_PROVIDER = Symbol("AI_PROVIDER");
