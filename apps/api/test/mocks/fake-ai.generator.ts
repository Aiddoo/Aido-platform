import {
  AiGenerationError,
  type AiFailureKind,
} from "#api/modules/ai-assistance/generation/application/ai-generation.errors";
import type {
  AiGenerationRequest,
  AiGenerationResult,
  AiGeneratorPort,
} from "#api/modules/ai-assistance/generation/application/ports/ai-generator.port";
import type { TodoDraft } from "#api/modules/ai-assistance/shared/domain/todo-draft.constants";
import { createTodoDraftResponse, type TodoDraftInput } from "#test/fixtures/ai-response.fixture";

export interface FakeAiGeneratorOptions {
  defaultResponse?: TodoDraftInput;
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
    provider: kind === "UNAVAILABLE" || kind === "CIRCUIT_OPEN" ? null : "google",
    attempts: kind === "UNAVAILABLE" || kind === "CIRCUIT_OPEN" ? 0 : 1,
    fallbackFrom: null,
    estimatedCostMicroUsd: 0,
    upstream: null,
  });
}

/** 업체 체인 없이 정해 둔 응답을 스키마로 검증해 돌려주는 생성기. */
export class FakeAiGenerator implements AiGeneratorPort {
  #responses: unknown[] = [];
  #defaultResponse: TodoDraft = createTodoDraftResponse();
  readonly #initialResponse: TodoDraft;
  readonly #initialAvailable: boolean;
  readonly #initialDelayMs: number;
  #callHistory: CallRecord[] = [];
  #isAvailable = true;
  #failureError: Error | null | undefined = undefined;
  #delayMs = 0;
  #tokenUsage: FakeTokenUsage = DEFAULT_TOKEN_USAGE;

  constructor(options?: FakeAiGeneratorOptions) {
    if (options?.defaultResponse) {
      this.#defaultResponse = createTodoDraftResponse({
        ...this.#defaultResponse,
        ...options.defaultResponse,
      });
    }
    if (options?.defaultAvailable !== undefined) {
      this.#isAvailable = options.defaultAvailable;
    }
    if (options?.defaultDelayMs !== undefined) {
      this.#delayMs = options.defaultDelayMs;
    }
    this.#initialResponse = structuredClone(this.#defaultResponse);
    this.#initialAvailable = this.#isAvailable;
    this.#initialDelayMs = this.#delayMs;
  }

  async generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    this.#callHistory.push({
      system: request.system,
      prompt: request.prompt,
      request,
      timestamp: new Date(),
    });
    if (this.#delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.#delayMs));
    }
    if (!this.#isAvailable) {
      throw createAiGenerationError("UNAVAILABLE");
    }
    if (this.#failureError !== undefined) {
      throw this.#failureError ?? new Error("AI parsing failed");
    }
    const response = this.#responses.shift() ?? structuredClone(this.#defaultResponse);
    return {
      output: request.schema.parse(response),
      provider: "google",
      model: "fake:test-model",
      attempts: 1,
      fallbackFrom: null,
      latencyMs: 0,
      inputTokens: this.#tokenUsage.input,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: this.#tokenUsage.output,
      reasoningTokens: this.#tokenUsage.reasoning,
      estimatedCostMicroUsd: 0,
      finishReason: "stop",
    };
  }

  /** 다음 parse-todo 응답(일정 표현). 다른 작업의 출력은 setRawResponse로 넣는다. */
  setResponse(response: TodoDraftInput): this {
    this.#responses.push(createTodoDraftResponse({ ...this.#defaultResponse, ...response }));
    return this;
  }

  setResponses(responses: TodoDraftInput[]): this {
    for (const response of responses) {
      this.setResponse(response);
    }
    return this;
  }

  setDefaultResponse(response: TodoDraftInput): this {
    this.#defaultResponse = createTodoDraftResponse({ ...this.#defaultResponse, ...response });
    return this;
  }

  /** false면 보낼 수 있는 업체가 없는 것처럼 UNAVAILABLE을 던진다. */
  setAvailable(available: boolean): this {
    this.#isAvailable = available;
    return this;
  }

  /** 다음 호출부터 이 오류(없으면 출력 검증 실패와 같은 일반 오류)를 던진다. */
  setInvalidResponse(error?: Error): this {
    this.#failureError = error ?? null;
    return this;
  }

  setDelay(ms: number): this {
    this.#delayMs = ms;
    return this;
  }

  setTokenUsage(usage: Partial<FakeTokenUsage>): this {
    this.#tokenUsage = { ...this.#tokenUsage, ...usage };
    return this;
  }

  getCallCount(): number {
    return this.#callHistory.length;
  }

  getLastPrompt(): string | undefined {
    return this.#callHistory.at(-1)?.prompt;
  }

  getLastSystem(): string | undefined {
    return this.#callHistory.at(-1)?.system;
  }

  getLastRequest(): AiGenerationRequest<unknown> | undefined {
    return this.#callHistory.at(-1)?.request;
  }

  getCallHistory(): CallRecord[] {
    return [...this.#callHistory];
  }

  getCall(index: number): CallRecord | undefined {
    return this.#callHistory[index];
  }

  setRawResponse(response: Record<string, unknown>): this {
    this.#responses.push(structuredClone(response));
    return this;
  }

  clear(): this {
    this.#responses = [];
    this.#callHistory = [];
    this.#defaultResponse = structuredClone(this.#initialResponse);
    this.#isAvailable = this.#initialAvailable;
    this.#failureError = undefined;
    this.#delayMs = this.#initialDelayMs;
    this.#tokenUsage = DEFAULT_TOKEN_USAGE;
    return this;
  }

  clearHistory(): this {
    this.#callHistory = [];
    return this;
  }

  clearResponses(): this {
    this.#responses = [];
    return this;
  }
}
