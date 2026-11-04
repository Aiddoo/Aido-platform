import type { AiProviderId } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateText, Output } from "ai";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import {
  AiGenerationError,
  type AiFailureKind,
  type AiUpstreamCause,
  resolveAiFailureRule,
} from "../../../application/ports/generation/ai-generation.errors.js";
import type {
  AiGenerationRequest,
  AiGenerationResult,
  AiGeneratorPort,
} from "../../../application/ports/generation/ai-generator.port.js";
import { planAiRoute } from "../../../domain/policies/generation/ai-route.policy.js";
import { AiProviderLogEvent } from "../../observability/generation/ai-provider-log.events.js";
import { type AiGenerationPolicy, resolveGenerationPolicy } from "./ai-generation-policy.js";
import { estimateCostMicroUsd } from "./ai-model-pricing.js";
import {
  AiAttemptFailure,
  AiCircuitOpenError,
  AiProviderCircuitRegistry,
} from "./ai-provider-circuit.registry.js";
import {
  AI_PROVIDER_ADAPTERS,
  type AiProviderAdapter,
  type AiProviderModel,
} from "./providers/ai-provider-adapter.js";
import { describeUpstreamCause, readFailedUsage } from "./providers/ai-sdk-failure.js";

/** 사람이 키·요청을 확인해야 하는 실패. 다음 업체로 넘기면서 error로 남긴다. */
const OPERATOR_FAILURES: ReadonlySet<AiFailureKind> = new Set(["AUTH", "BAD_REQUEST"]);

/** 같은 업체를 부르는 최대 횟수. 스키마 불일치(retrySameProvider)만 한 번 더 묻는다. */
const MAX_CALLS_PER_PROVIDER = 2;

type Attempt<T> =
  | { readonly type: "succeeded"; readonly result: AiGenerationResult<T> }
  | { readonly type: "failed"; readonly failure: AiFailedAttempt }
  /** 경로를 고른 뒤 회로가 열려 부르지 않았다 */
  | { readonly type: "skipped" };

interface AiFailedAttempt {
  readonly kind: AiFailureKind;
  readonly upstream: AiUpstreamCause;
}

/** 시도마다 더하는 비용. 단가를 모르는 모델을 한 번이라도 쓰면 null이다. */
class CostMeter {
  #microUsd: number | null = 0;

  add(cost: number | null): void {
    this.#microUsd = this.#microUsd == null || cost == null ? null : this.#microUsd + cost;
  }

  get microUsd(): number | null {
    return this.#microUsd;
  }
}

/**
 * 설정 순서 → 동의 범위 → 열린 회로 제외로 고른 업체를 차례로 시도한다.
 * 앞 업체는 SDK 재시도 없이 바로 넘기고, 체인 전체에 작업별 제한 시간 하나를 건다.
 */
@Injectable()
export class AiSdkGenerator implements AiGeneratorPort {
  readonly #logger = new Logger(AiSdkGenerator.name);
  readonly #adapters: ReadonlyMap<AiProviderId, AiProviderAdapter>;

  constructor(
    private readonly config: TypedConfigService,
    @Inject(AI_PROVIDER_ADAPTERS) adapters: readonly AiProviderAdapter[],
    private readonly circuits: AiProviderCircuitRegistry,
  ) {
    this.#adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  async generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    const startedAt = performance.now();
    const { ai } = this.config;
    const route = planAiRoute({
      order: ai.providerOrder,
      configured: new Set(
        [...this.#adapters.values()]
          .filter((adapter) => adapter.getModel(request.task) != null)
          .map((adapter) => adapter.id),
      ),
      agreedVersion: request.agreedConsentVersion,
      openCircuits: this.circuits.openProviders(),
    });
    const policy = resolveGenerationPolicy(request.task, ai.tasks[request.task]);
    const deadline = AbortSignal.timeout(policy.deadlineMs);
    const signal = request.signal == null ? deadline : AbortSignal.any([deadline, request.signal]);
    const cost = new CostMeter();
    let attempts = 0;
    let last: { provider: AiProviderId; failure: AiFailedAttempt } | null = null;

    for (const [index, provider] of route.entries()) {
      const adapter = this.#adapters.get(provider);
      const model = adapter?.getModel(request.task);
      if (adapter == null || model == null) {
        continue;
      }
      const isLast = index === route.length - 1;
      for (let call = 0; call < MAX_CALLS_PER_PROVIDER; call++) {
        if (signal.aborted) {
          break;
        }
        attempts++;
        const attempt = await this.#attempt(adapter, model, request, {
          policy,
          signal,
          maxRetries: isLast ? policy.lastProviderMaxRetries : 0,
          cost,
          startedAt,
        });
        if (attempt.type === "succeeded") {
          return {
            ...attempt.result,
            attempts,
            fallbackFrom: provider === route[0] ? null : (route[0] ?? null),
            estimatedCostMicroUsd: cost.microUsd,
          };
        }
        if (attempt.type === "skipped") {
          attempts--;
          break;
        }
        last = { provider, failure: attempt.failure };
        const rule = resolveAiFailureRule(attempt.failure.kind);
        if (!rule.fallback || signal.aborted) {
          throw this.#failed(last, { attempts, route, cost });
        }
        if (!(rule.retrySameProvider && call === 0)) {
          break;
        }
      }
      if (signal.aborted) {
        break;
      }
      const next = route[index + 1];
      if (last?.provider === provider && next != null) {
        this.#logFallback(request, provider, next, last.failure);
      }
    }

    if (signal.aborted) {
      throw this.#failed(
        {
          provider: last?.provider ?? null,
          failure: { kind: "TIMEOUT", upstream: { errorType: "TimeoutError" } },
        },
        { attempts, route, cost },
      );
    }
    if (last == null) {
      throw new AiGenerationError("UNAVAILABLE", {
        provider: null,
        attempts,
        fallbackFrom: null,
        estimatedCostMicroUsd: cost.microUsd,
      });
    }
    throw this.#failed(last, { attempts, route, cost });
  }

  /** 한 업체를 한 번 부른다. */
  async #attempt<T>(
    adapter: AiProviderAdapter,
    model: AiProviderModel,
    request: AiGenerationRequest<T>,
    options: {
      readonly policy: AiGenerationPolicy;
      readonly signal: AbortSignal;
      readonly maxRetries: number;
      readonly cost: CostMeter;
      readonly startedAt: number;
    },
  ): Promise<Attempt<T>> {
    const { policy, signal, maxRetries, cost, startedAt } = options;
    try {
      const result = await this.circuits.execute(adapter.id, async () => {
        let counted = false;
        try {
          const systemOptions = adapter.getSystemProviderOptions(request.system);
          const generated = await generateText({
            model: model.model,
            ...(request.system !== "" && {
              instructions: {
                role: "system",
                content: request.system,
                ...(systemOptions != null && { providerOptions: systemOptions }),
              },
            }),
            prompt: request.prompt,
            output: Output.object({ schema: request.schema }),
            maxOutputTokens: policy.maxOutputTokens,
            maxRetries,
            abortSignal: signal,
            providerOptions: adapter.getProviderOptions(policy),
          });
          cost.add(estimateCostMicroUsd(model.id, generated.usage));
          counted = true;
          // 응답이 안전 정책으로 막히면 SDK는 throw 없이 끝나고 output 접근에서야 실패한다.
          if (generated.finishReason === "content-filter") {
            throw new AiAttemptFailure("BLOCKED", request.task, {});
          }
          return { generated, output: generated.output };
        } catch (error) {
          if (error instanceof AiAttemptFailure) {
            throw error;
          }
          if (!counted) {
            cost.add(estimateCostMicroUsd(model.id, readFailedUsage(error)));
          }
          const kind = signal.aborted ? "TIMEOUT" : adapter.classifyError(error);
          throw new AiAttemptFailure(kind, request.task, { cause: error });
        }
      });
      const { generated, output } = result;
      return {
        type: "succeeded",
        result: {
          output,
          provider: adapter.id,
          model: model.id,
          attempts: 1,
          fallbackFrom: null,
          latencyMs: Math.round(performance.now() - startedAt),
          inputTokens: generated.usage.inputTokens ?? 0,
          outputTokens: generated.usage.outputTokens ?? 0,
          reasoningTokens: generated.usage.outputTokenDetails.reasoningTokens ?? 0,
          estimatedCostMicroUsd: null,
          finishReason: generated.finishReason,
        },
      };
    } catch (error) {
      if (error instanceof AiCircuitOpenError) {
        return { type: "skipped" };
      }
      if (error instanceof AiAttemptFailure) {
        return {
          type: "failed",
          failure: { kind: error.kind, upstream: describeUpstreamCause(error.cause ?? error) },
        };
      }
      return {
        type: "failed",
        failure: { kind: "UPSTREAM", upstream: describeUpstreamCause(error) },
      };
    }
  }

  #logFallback<T>(
    request: AiGenerationRequest<T>,
    from: AiProviderId,
    to: AiProviderId,
    failure: AiFailedAttempt,
  ): void {
    const event = {
      event: AiProviderLogEvent.FALLBACK,
      task: request.task,
      from,
      to,
      errorType: failure.kind,
      ...(failure.upstream.statusCode != null && { statusCode: failure.upstream.statusCode }),
    };
    if (OPERATOR_FAILURES.has(failure.kind)) {
      this.#logger.error(event);
      return;
    }
    this.#logger.warn(event);
  }

  #failed(
    last: { readonly provider: AiProviderId | null; readonly failure: AiFailedAttempt },
    context: {
      readonly attempts: number;
      readonly route: readonly AiProviderId[];
      readonly cost: CostMeter;
    },
  ): AiGenerationError {
    const first = context.route[0] ?? null;
    return new AiGenerationError(last.failure.kind, {
      provider: last.provider,
      attempts: context.attempts,
      fallbackFrom: last.provider != null && last.provider !== first ? first : null,
      estimatedCostMicroUsd: context.cost.microUsd,
      upstream: last.failure.upstream,
    });
  }
}
