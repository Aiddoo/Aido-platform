/**
 * FakeAiProvider - 테스트용 AI Provider Mock
 *
 * Unit/Integration/E2E 테스트에서 실제 AI API 호출 없이
 * AI 기능을 테스트할 수 있게 해주는 Mock Provider입니다.
 */

import type { ParsedTodoData } from "@aido/validators";
import type {
	AiProvider,
	GenerateStructuredOptions,
	GenerateStructuredResult,
	TokenUsage,
} from "../../src/modules/ai/providers/ai.provider";

/**
 * FakeAiProvider 설정 옵션
 */
export interface FakeAiProviderOptions {
	/** 기본 응답 */
	defaultResponse?: Partial<ParsedTodoData>;
	/** 기본 가용성 */
	defaultAvailable?: boolean;
	/** 기본 지연 시간 (ms) */
	defaultDelayMs?: number;
}

/**
 * 호출 기록 정보
 */
export interface CallRecord {
	prompt: string;
	options: GenerateStructuredOptions<unknown>;
	timestamp: Date;
}

/**
 * FakeAiProvider
 *
 * @example
 * ```typescript
 * const fakeProvider = new FakeAiProvider();
 *
 * // 응답 설정
 * fakeProvider.setResponse({
 *   title: '팀 미팅',
 *   startDate: '2025-01-26',
 *   scheduledTime: '15:00',
 *   isAllDay: false,
 * });
 *
 * // 테스트에서 사용
 * const result = await fakeProvider.generateStructured({ ... });
 *
 * // 호출 확인
 * expect(fakeProvider.getCallCount()).toBe(1);
 * ```
 */
export class FakeAiProvider implements AiProvider {
	private _responses: Partial<ParsedTodoData>[] = [];
	private _defaultResponse: ParsedTodoData = {
		title: "테스트 할 일",
		startDate: "2025-01-25",
		endDate: null,
		scheduledTime: null,
		isAllDay: true,
	};
	private _callHistory: CallRecord[] = [];
	private _isAvailable = true;
	private _shouldFail = false;
	private _failureError: Error | null = null;
	private _delayMs = 0;
	private _tokenUsage: TokenUsage = { input: 150, output: 50 };

	constructor(options?: FakeAiProviderOptions) {
		if (options?.defaultResponse) {
			this._defaultResponse = {
				...this._defaultResponse,
				...options.defaultResponse,
			};
		}
		if (options?.defaultAvailable !== undefined) {
			this._isAvailable = options.defaultAvailable;
		}
		if (options?.defaultDelayMs !== undefined) {
			this._delayMs = options.defaultDelayMs;
		}
	}

	/**
	 * 구조화된 출력 생성 (Mock)
	 */
	async generateStructured<T>(
		options: GenerateStructuredOptions<T>,
	): Promise<GenerateStructuredResult<T>> {
		// 호출 기록
		this._callHistory.push({
			prompt: options.prompt,
			options: options as GenerateStructuredOptions<unknown>,
			timestamp: new Date(),
		});

		// 지연 시뮬레이션
		if (this._delayMs > 0) {
			await this.delay(this._delayMs);
		}

		// 실패 시뮬레이션
		if (this._shouldFail) {
			throw this._failureError ?? new Error("AI parsing failed");
		}

		// 응답 생성 (큐에서 가져오거나 기본값 사용)
		const response = this._responses.shift() ?? this._defaultResponse;
		const fullResponse: ParsedTodoData = {
			...this._defaultResponse,
			...response,
		};

		return {
			output: fullResponse as T,
			model: "fake:test-model",
			usage: { ...this._tokenUsage },
		};
	}

	/**
	 * Provider 가용성 확인
	 */
	isAvailable(): boolean {
		return this._isAvailable;
	}

	// ============================================
	// Test Helpers
	// ============================================

	/**
	 * 응답 설정 (큐에 추가)
	 *
	 * @param response - 부분 응답 객체
	 */
	setResponse(response: Partial<ParsedTodoData>): this {
		this._responses.push(response);
		return this;
	}

	/**
	 * 여러 응답 설정 (순차적으로 반환)
	 *
	 * @param responses - 응답 배열
	 */
	setResponses(responses: Partial<ParsedTodoData>[]): this {
		this._responses.push(...responses);
		return this;
	}

	/**
	 * 기본 응답 변경
	 *
	 * @param response - 새 기본 응답
	 */
	setDefaultResponse(response: Partial<ParsedTodoData>): this {
		this._defaultResponse = { ...this._defaultResponse, ...response };
		return this;
	}

	/**
	 * 가용성 설정
	 *
	 * @param available - 가용 여부
	 */
	setAvailable(available: boolean): this {
		this._isAvailable = available;
		return this;
	}

	/**
	 * 실패 모드 설정
	 *
	 * @param error - 던질 에러 (기본: "AI parsing failed")
	 */
	setInvalidResponse(error?: Error): this {
		this._shouldFail = true;
		this._failureError = error ?? null;
		return this;
	}

	/**
	 * 지연 시간 설정
	 *
	 * @param ms - 지연 시간 (밀리초)
	 */
	setDelay(ms: number): this {
		this._delayMs = ms;
		return this;
	}

	/**
	 * 토큰 사용량 설정
	 *
	 * @param usage - 토큰 사용량
	 */
	setTokenUsage(usage: Partial<TokenUsage>): this {
		this._tokenUsage = { ...this._tokenUsage, ...usage };
		return this;
	}

	/**
	 * 호출 횟수 반환
	 */
	getCallCount(): number {
		return this._callHistory.length;
	}

	/**
	 * 마지막 호출 프롬프트 반환
	 */
	getLastPrompt(): string | undefined {
		return this._callHistory[this._callHistory.length - 1]?.prompt;
	}

	/**
	 * 마지막 호출 옵션 반환
	 */
	getLastOptions(): GenerateStructuredOptions<unknown> | undefined {
		return this._callHistory[this._callHistory.length - 1]?.options;
	}

	/**
	 * 전체 호출 기록 반환
	 */
	getCallHistory(): CallRecord[] {
		return [...this._callHistory];
	}

	/**
	 * 특정 인덱스의 호출 기록 반환
	 *
	 * @param index - 호출 인덱스 (0부터 시작)
	 */
	getCall(index: number): CallRecord | undefined {
		return this._callHistory[index];
	}

	/**
	 * 상태 초기화
	 */
	clear(): this {
		this._responses = [];
		this._callHistory = [];
		this._isAvailable = true;
		this._shouldFail = false;
		this._failureError = null;
		this._delayMs = 0;
		this._tokenUsage = { input: 150, output: 50 };
		return this;
	}

	/**
	 * 호출 기록만 초기화
	 */
	clearHistory(): this {
		this._callHistory = [];
		return this;
	}

	/**
	 * 응답 큐만 초기화
	 */
	clearResponses(): this {
		this._responses = [];
		return this;
	}

	// ============================================
	// Private Helpers
	// ============================================

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * FakeAiProvider 팩토리 함수
 *
 * @param options - 초기 설정
 */
export function createFakeAiProvider(
	options?: FakeAiProviderOptions,
): FakeAiProvider {
	return new FakeAiProvider(options);
}
