import type { ParsedTodoData } from "@aido/api";

import {
  AiGenerationError,
  type AiFailureKind,
} from "#api/modules/ai-assistance/application/ports/generation/ai-generation.errors";
import type {
  AiGenerationRequest,
  AiGenerationResult,
  AiGeneratorPort,
} from "#api/modules/ai-assistance/application/ports/generation/ai-generator.port";
import { createParsedTodoResponse } from "#test/fixtures/ai-response.fixture";

export interface FakeAiGeneratorOptions {
  defaultResponse?: Partial<ParsedTodoData>;
  defaultAvailable?: boolean;
  defaultDelayMs?: number;
}

export interface CallRecord {
  system?: string;
  prompt: string;
  request: AiGenerationRequest<unknown>;
  timestamp: Date;
}

interface FakeTokenUsage {
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
}

const DEFAULT_TOKEN_USAGE: FakeTokenUsage = { input: 150, output: 50, reasoning: 0 };

/** 생성기가 끝내 실패했을 때 던지는 오류(업체 체인 정보 없이 종류만). */
export function createAiGenerationError(kind: AiFailureKind): AiGenerationError {
  return new AiGenerationError(kind, {
    provider: kind === "UNAVAILABLE" ? null : "google",
    attempts: kind === "UNAVAILABLE" ? 0 : 1,
    fallbackFrom: null,
    estimatedCostMicroUsd: 0,
  });
}

/** 업체 체인 없이 정해 둔 응답을 스키마로 검증해 돌려주는 생성기. */
export class FakeAiGenerator implements AiGeneratorPort {
  private _responses: Record<string, unknown>[] = [];
  private _defaultResponse: ParsedTodoData = createParsedTodoResponse();
  private readonly _initialResponse: ParsedTodoData;
  private readonly _initialAvailable: boolean;
  private readonly _initialDelayMs: number;
  private _callHistory: CallRecord[] = [];
  private _isAvailable = true;
  private _failureError: Error | null | undefined = undefined;
  private _delayMs = 0;
  private _tokenUsage: FakeTokenUsage = DEFAULT_TOKEN_USAGE;

  constructor(options?: FakeAiGeneratorOptions) {
    if (options?.defaultResponse) {
      this._defaultResponse = { ...this._defaultResponse, ...options.defaultResponse };
    }
    if (options?.defaultAvailable !== undefined) {
      this._isAvailable = options.defaultAvailable;
    }
    if (options?.defaultDelayMs !== undefined) {
      this._delayMs = options.defaultDelayMs;
    }
    this._initialResponse = structuredClone(this._defaultResponse);
    this._initialAvailable = this._isAvailable;
    this._initialDelayMs = this._delayMs;
  }

  async generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    this._callHistory.push({
      system: request.system,
      prompt: request.prompt,
      request,
      timestamp: new Date(),
    });
    if (this._delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this._delayMs));
    }
    if (!this._isAvailable) {
      throw createAiGenerationError("UNAVAILABLE");
    }
    if (this._failureError !== undefined) {
      throw this._failureError ?? new Error("AI parsing failed");
    }
    const response = this._responses.shift() ?? structuredClone(this._defaultResponse);
    return {
      output: request.schema.parse(response),
      provider: "google",
      model: "fake:test-model",
      attempts: 1,
      fallbackFrom: null,
      latencyMs: 0,
      inputTokens: this._tokenUsage.input,
      outputTokens: this._tokenUsage.output,
      reasoningTokens: this._tokenUsage.reasoning,
      estimatedCostMicroUsd: 0,
      finishReason: "stop",
    };
  }

  setResponse(response: Partial<ParsedTodoData>): this {
    this._responses.push(createParsedTodoResponse({ ...this._defaultResponse, ...response }));
    return this;
  }

  setResponses(responses: Partial<ParsedTodoData>[]): this {
    for (const response of responses) {
      this.setResponse(response);
    }
    return this;
  }

  setDefaultResponse(response: Partial<ParsedTodoData>): this {
    this._defaultResponse = { ...this._defaultResponse, ...response };
    return this;
  }

  /** false면 보낼 수 있는 업체가 없는 것처럼 UNAVAILABLE을 던진다. */
  setAvailable(available: boolean): this {
    this._isAvailable = available;
    return this;
  }

  /** 다음 호출부터 이 오류(없으면 출력 검증 실패와 같은 일반 오류)를 던진다. */
  setInvalidResponse(error?: Error): this {
    this._failureError = error ?? null;
    return this;
  }

  setDelay(ms: number): this {
    this._delayMs = ms;
    return this;
  }

  setTokenUsage(usage: Partial<FakeTokenUsage>): this {
    this._tokenUsage = { ...this._tokenUsage, ...usage };
    return this;
  }

  getCallCount(): number {
    return this._callHistory.length;
  }

  getLastPrompt(): string | undefined {
    return this._callHistory.at(-1)?.prompt;
  }

  getLastSystem(): string | undefined {
    return this._callHistory.at(-1)?.system;
  }

  getLastRequest(): AiGenerationRequest<unknown> | undefined {
    return this._callHistory.at(-1)?.request;
  }

  getCallHistory(): CallRecord[] {
    return [...this._callHistory];
  }

  getCall(index: number): CallRecord | undefined {
    return this._callHistory[index];
  }

  setRawResponse(response: Record<string, unknown>): this {
    this._responses.push(structuredClone(response));
    return this;
  }

  clear(): this {
    this._responses = [];
    this._callHistory = [];
    this._defaultResponse = structuredClone(this._initialResponse);
    this._isAvailable = this._initialAvailable;
    this._failureError = undefined;
    this._delayMs = this._initialDelayMs;
    this._tokenUsage = DEFAULT_TOKEN_USAGE;
    return this;
  }

  clearHistory(): this {
    this._callHistory = [];
    return this;
  }

  clearResponses(): this {
    this._responses = [];
    return this;
  }
}
