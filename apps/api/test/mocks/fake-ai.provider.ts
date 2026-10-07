import type { ParsedTodoData } from "@aido/api";

import type {
  AiProvider,
  GenerateStructuredOptions,
  GenerateStructuredResult,
  TokenUsage,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";

export interface FakeAiProviderOptions {
  defaultResponse?: Partial<ParsedTodoData>;
  defaultAvailable?: boolean;
  defaultDelayMs?: number;
}

export interface CallRecord {
  system?: string;
  prompt: string;
  options: GenerateStructuredOptions<unknown>;
  timestamp: Date;
}

export class FakeAiProvider implements AiProvider {
  private _responses: Record<string, unknown>[] = [];
  private _defaultResponse: ParsedTodoData = {
    title: "테스트 할 일",
    startDate: "2025-01-25",
    endDate: null,
    scheduledTime: null,
    isAllDay: true,
    isRecurring: false,
    recurrence: null,
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

  async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    this._callHistory.push({
      system: options.system,
      prompt: options.prompt,
      options,
      timestamp: new Date(),
    });
    if (this._delayMs > 0) {
      await this.delay(this._delayMs);
    }
    if (this._shouldFail) {
      throw this._failureError ?? new Error("AI parsing failed");
    }
    const response = this._responses.shift() ?? this._defaultResponse;
    const fullResponse: ParsedTodoData = {
      ...this._defaultResponse,
      ...response,
    };

    return {
      output: options.schema.parse(fullResponse),
      model: "fake:test-model",
      usage: { ...this._tokenUsage },
    };
  }

  isAvailable(): boolean {
    return this._isAvailable;
  }

  setResponse(response: Partial<ParsedTodoData>): this {
    this._responses.push(response);
    return this;
  }

  setResponses(responses: Partial<ParsedTodoData>[]): this {
    this._responses.push(...responses);
    return this;
  }

  setDefaultResponse(response: Partial<ParsedTodoData>): this {
    this._defaultResponse = { ...this._defaultResponse, ...response };
    return this;
  }

  setAvailable(available: boolean): this {
    this._isAvailable = available;
    return this;
  }

  setInvalidResponse(error?: Error): this {
    this._shouldFail = true;
    this._failureError = error ?? null;
    return this;
  }

  setDelay(ms: number): this {
    this._delayMs = ms;
    return this;
  }

  setTokenUsage(usage: Partial<TokenUsage>): this {
    this._tokenUsage = { ...this._tokenUsage, ...usage };
    return this;
  }

  getCallCount(): number {
    return this._callHistory.length;
  }

  getLastPrompt(): string | undefined {
    return this._callHistory[this._callHistory.length - 1]?.prompt;
  }

  getLastSystem(): string | undefined {
    return this._callHistory[this._callHistory.length - 1]?.system;
  }

  getLastOptions(): GenerateStructuredOptions<unknown> | undefined {
    return this._callHistory[this._callHistory.length - 1]?.options;
  }

  getCallHistory(): CallRecord[] {
    return [...this._callHistory];
  }

  getCall(index: number): CallRecord | undefined {
    return this._callHistory[index];
  }

  setRawResponse(response: Record<string, unknown>): this {
    this._responses.push(response);
    return this;
  }

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

  clearHistory(): this {
    this._callHistory = [];
    return this;
  }

  clearResponses(): this {
    this._responses = [];
    return this;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createFakeAiProvider(options?: FakeAiProviderOptions): FakeAiProvider {
  return new FakeAiProvider(options);
}
