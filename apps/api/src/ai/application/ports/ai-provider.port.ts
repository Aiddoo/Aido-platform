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
 * 모델 선택 힌트
 *
 * 현재는 Gemini Flash-Lite 단일 모델만 사용하지만, 향후 경로별로 다른 모델을
 * 추가할 수 있도록 힌트 타입을 유지합니다. 확장 예: `"fast"`, `"quality"`.
 */
export type AiModelHint = "default";

/**
 * 구조화된 생성 옵션
 */
export interface GenerateStructuredOptions<T> {
	/** 시스템 메시지 (역할, 규칙, 제약 조건) */
	system?: string;
	/** 프롬프트 텍스트 */
	prompt: string;
	/** 출력 스키마 (Zod) */
	schema: z.ZodSchema<T>;
	/** 최대 출력 토큰 수 */
	maxOutputTokens?: number;
	/** 모델 선택 힌트 (라우터가 있는 환경에서만 의미 있음) */
	modelHint?: AiModelHint;
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
 *   maxOutputTokens: 150,
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
