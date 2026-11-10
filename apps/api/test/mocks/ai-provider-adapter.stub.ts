import { setTimeout } from "node:timers/promises";

import type { AiProviderId } from "@aido/api/vocabulary";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import type { AiFailureKind } from "#api/modules/ai-assistance/generation/application/ai-generation.errors";
import {
  AiProviderAdapter,
  type AiProviderDataHandling,
  type AiProviderModel,
} from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-provider.adapter";
import { classifyAiSdkError } from "#api/modules/ai-assistance/generation/infrastructure/adapters/ai-sdk-failure.mapper";

/** 한 번의 모델 호출 결과. status는 그 HTTP 상태의 업체 오류다. */
export type StubModelStep =
  | { readonly type: "ok"; readonly text: string; readonly delayMs?: number }
  | { readonly type: "status"; readonly status: number; readonly retryable: boolean }
  | { readonly type: "finish"; readonly reason: "length" | "content-filter"; readonly text: string }
  | { readonly type: "hang" };

const STATUS_KINDS: Readonly<Record<number, AiFailureKind>> = {
  400: "BAD_REQUEST",
  401: "AUTH",
  402: "QUOTA_EXHAUSTED",
  429: "RATE_LIMITED",
  503: "OVERLOADED",
};

const USAGE = {
  inputTokens: { total: 1_000, noCache: 1_000, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 200, text: 200, reasoning: 0 },
};

/**
 * 업체 SDK 대신 정해 둔 단계대로 응답하는 업체 전략. 단계가 바닥나면 마지막 단계를 되풀이한다.
 * 모델 ID는 실제 기본 모델이라 단가표로 비용이 계산된다.
 */
export class StubProviderAdapter extends AiProviderAdapter {
  readonly dataHandling: AiProviderDataHandling = {
    trainsOnUserData: false,
    disablesResponseStorage: false,
    basis: "test",
  };
  readonly model: MockLanguageModelV4;
  readonly #steps: StubModelStep[];
  #last: StubModelStep;
  readonly id: AiProviderId;
  readonly #modelId: string;
  readonly #configured: boolean;

  constructor(
    id: AiProviderId,
    steps: readonly StubModelStep[],
    modelId: string,
    configured = true,
  ) {
    super();
    this.id = id;
    this.#modelId = modelId;
    this.#configured = configured;
    this.#steps = [...steps];
    this.#last = steps.at(-1) ?? { type: "ok", text: "{}" };
    this.model = new MockLanguageModelV4({
      provider: id,
      modelId,
      doGenerate: async (options) => {
        const step = this.#steps.shift() ?? this.#last;
        this.#last = step;
        if (step.type === "status") {
          throw new APICallError({
            message: `fixture ${step.status}`,
            url: `https://${id}.example/v1`,
            requestBodyValues: {},
            statusCode: step.status,
            isRetryable: step.retryable,
          });
        }
        if (step.type === "hang") {
          return new Promise((_resolve, reject) => {
            options.abortSignal?.addEventListener("abort", () =>
              reject(options.abortSignal?.reason),
            );
          });
        }
        if (step.type === "ok" && step.delayMs != null) {
          await setTimeout(step.delayMs);
        }
        return {
          content: [{ type: "text", text: step.text }],
          finishReason: {
            unified: step.type === "ok" ? "stop" : step.reason,
            raw: undefined,
          },
          usage: USAGE,
          warnings: [],
        };
      },
    });
  }

  get callCount(): number {
    return this.model.doGenerateCalls.length;
  }

  getModel(): AiProviderModel | null {
    return this.#configured ? { id: `${this.id}:${this.#modelId}`, model: this.model } : null;
  }

  getProviderOptions() {
    return {};
  }

  getSystemProviderOptions(): undefined {
    return undefined;
  }

  classifyError(error: unknown): AiFailureKind {
    return classifyAiSdkError(error, (status) => STATUS_KINDS[status ?? 500] ?? "UPSTREAM");
  }
}

export const ok = (text = '{"title":"독서"}'): StubModelStep => ({ type: "ok", text });
export const status = (code: number, retryable = false): StubModelStep => ({
  type: "status",
  status: code,
  retryable,
});
