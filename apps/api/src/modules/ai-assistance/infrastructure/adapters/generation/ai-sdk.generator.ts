import { createHash } from "node:crypto";

import { AI_PROVIDER_IDS, type AiProviderId } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateText, Output } from "ai";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundRejectedError } from "#api/platform/resilience/outbound-policy.errors";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

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
  AiTaskClass,
} from "../../../application/ports/generation/ai-generator.port.js";
import { planAiRoute } from "../../../domain/policies/generation/ai-route.policy.js";
import {
  AiGuardLogEvent,
  AiProviderLogEvent,
} from "../../observability/generation/ai-provider-log.events.js";
import {
  type AiGenerationPolicy,
  FRONT_PROVIDER_DEADLINE_SHARE,
  resolveGenerationPolicy,
} from "./ai-generation-policy.js";
import { estimateCostMicroUsd, estimateSpendMicroUsd } from "./ai-model-pricing.js";
import {
  AI_TASK_CLASS_POLICIES,
  AiAttemptFailure,
  aiProviderPolicy,
} from "./ai-outbound.policies.js";
import { AiSpendGuard } from "./ai-spend.guard.js";
import {
  AI_PROVIDER_ADAPTERS,
  type AiProviderAdapter,
  type AiProviderModel,
} from "./providers/ai-provider-adapter.js";
import { describeUpstreamCause, readFailedUsage } from "./providers/ai-sdk-failure.js";

/** 사람이 키·요청을 확인해야 하는 실패. 다음 업체로 넘기면서 error로 남긴다. */
const OPERATOR_FAILURES: ReadonlySet<AiFailureKind> = new Set(["AUTH", "BAD_REQUEST"]);

/** 스키마 불일치(retrySameProvider)는 첫 업체에만 한 번 더 묻는다. */
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

/**
 * 시도마다 더하는 비용. estimated는 응답·로그에 싣는 토큰 기준 값(단가를 모르면 null)이고,
 * spend는 예산에 더하는 보수적 추정값이다.
 */
class CostMeter {
  #estimated: number | null = 0;
  #spend = 0;

  add(estimated: number | null, spend: number): void {
    this.#estimated =
      this.#estimated == null || estimated == null ? null : this.#estimated + estimated;
    this.#spend += spend;
  }

  get estimatedMicroUsd(): number | null {
    return this.#estimated;
  }

  get spendMicroUsd(): number {
    return this.#spend;
  }
}

interface ChainContext {
  readonly policy: AiGenerationPolicy;
  readonly signal: AbortSignal;
  readonly startedAt: number;
  readonly cost: CostMeter;
}

/**
 * 입력 상한 → 킬 스위치·비용 예산 → 같은 요청 합치기 → 작업 분류 bulkhead → 업체 체인 순서로 생성한다.
 * 업체는 설정 순서 → 동의 범위 → 열린 회로 제외로 고르고, 앞 업체는 SDK 재시도 없이 체인 제한 시간의
 * 절반 안에서만 기다린 뒤 넘긴다. 끝나면 이번 요청의 추정 비용을 예산에 한 번 더한다.
 */
@Injectable()
export class AiSdkGenerator implements AiGeneratorPort {
  readonly #logger = new Logger(AiSdkGenerator.name);
  readonly #adapters: ReadonlyMap<AiProviderId, AiProviderAdapter>;
  readonly #providerPolicies: ReadonlyMap<AiProviderId, OutboundPolicy>;
  readonly #classPolicies: Readonly<Record<AiTaskClass, OutboundPolicy>>;
  readonly #inflight = new Map<string, Promise<AiGenerationResult<unknown>>>();

  constructor(
    private readonly config: TypedConfigService,
    @Inject(AI_PROVIDER_ADAPTERS) adapters: readonly AiProviderAdapter[],
    policies: OutboundPolicyRegistry,
    private readonly spend: AiSpendGuard,
  ) {
    this.#adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
    this.#providerPolicies = new Map(
      AI_PROVIDER_IDS.map((provider) => [
        provider,
        policies.get(aiProviderPolicy(provider, config.ai.breaker)),
      ]),
    );
    this.#classPolicies = {
      interactive: policies.get(AI_TASK_CLASS_POLICIES.interactive),
      background: policies.get(AI_TASK_CLASS_POLICIES.background),
    };
  }

  async generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    this.#assertInputSize(request);
    await this.#assertSpendAllowed(request);

    const key = coalescingKey(request);
    const shared = this.#inflight.get(key);
    if (shared != null) {
      const result = await shared;
      return { ...result, output: request.schema.parse(result.output) };
    }
    const pending = this.#generateOnce(request);
    this.#inflight.set(key, pending);
    try {
      return await pending;
    } finally {
      this.#inflight.delete(key);
    }
  }

  #assertInputSize<T>(request: AiGenerationRequest<T>): void {
    const inputChars = request.prompt.length;
    if (inputChars <= request.maxInputChars) {
      return;
    }
    this.#logger.error({
      event: AiGuardLogEvent.INPUT_REJECTED,
      task: request.task,
      inputChars,
      maxInputChars: request.maxInputChars,
    });
    throw withheld("BAD_REQUEST");
  }

  async #assertSpendAllowed<T>(request: AiGenerationRequest<T>): Promise<void> {
    const decision = await this.spend.decide({
      taskClass: request.taskClass,
      userId: request.userId,
    });
    if (decision.type === "allowed") {
      return;
    }
    if (decision.type === "halted") {
      this.#logger.warn({
        event: AiGuardLogEvent.SPEND_HALTED,
        task: request.task,
        taskClass: request.taskClass,
        reason: decision.reason,
      });
      throw withheld("HALTED");
    }
    this.#logger.warn({
      event: AiGuardLogEvent.SPEND_USER_LIMITED,
      task: request.task,
      userId: request.userId,
    });
    throw withheld("USER_SPEND_LIMITED");
  }

  async #generateOnce<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    const startedAt = performance.now();
    const settings = this.config.ai.tasks[request.task];
    const policy = resolveGenerationPolicy(request.task, request.taskClass, settings);
    const deadline = AbortSignal.timeout(policy.deadlineMs);
    const signal = request.signal == null ? deadline : AbortSignal.any([deadline, request.signal]);
    const cost = new CostMeter();
    try {
      return await this.#classPolicies[request.taskClass].execute(
        () => this.#chain(request, { policy, signal, startedAt, cost }),
        signal,
      );
    } catch (error) {
      if (error instanceof OutboundRejectedError) {
        throw withheld("RATE_LIMITED");
      }
      if (!(error instanceof AiGenerationError) && signal.aborted) {
        throw withheld("TIMEOUT");
      }
      throw error;
    } finally {
      await this.spend.record(request.userId, cost.spendMicroUsd);
    }
  }

  async #chain<T>(
    request: AiGenerationRequest<T>,
    context: ChainContext,
  ): Promise<AiGenerationResult<T>> {
    const { policy, signal, cost } = context;
    const route = planAiRoute({
      order: this.config.ai.providerOrder,
      configured: new Set(
        [...this.#adapters.values()]
          .filter((adapter) => adapter.getModel(request.task) != null)
          .map((adapter) => adapter.id),
      ),
      agreedVersion: request.agreedConsentVersion,
      openCircuits: new Set(
        AI_PROVIDER_IDS.filter((provider) => this.#providerPolicies.get(provider)?.isOpen()),
      ),
    });
    let attempts = 0;
    let last: { provider: AiProviderId; failure: AiFailedAttempt } | null = null;

    for (const [index, provider] of route.entries()) {
      const adapter = this.#adapters.get(provider);
      const model = adapter?.getModel(request.task);
      if (adapter == null || model == null) {
        continue;
      }
      const maxCalls = index === 0 ? MAX_CALLS_PER_PROVIDER : 1;
      for (let call = 0; call < maxCalls && attempts < policy.maxModelCalls; call++) {
        if (signal.aborted) {
          break;
        }
        const isLast = index === route.length - 1 || attempts + 1 >= policy.maxModelCalls;
        attempts++;
        const attempt = await this.#attempt(adapter, model, request, { ...context, isLast });
        if (attempt.type === "succeeded") {
          return {
            ...attempt.result,
            attempts,
            fallbackFrom: provider === route[0] ? null : (route[0] ?? null),
            estimatedCostMicroUsd: cost.estimatedMicroUsd,
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
        if (!rule.retrySameProvider) {
          break;
        }
      }
      if (signal.aborted || attempts >= policy.maxModelCalls) {
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
        estimatedCostMicroUsd: cost.estimatedMicroUsd,
        upstream: null,
      });
    }
    throw this.#failed(last, { attempts, route, cost });
  }

  /** 한 업체를 한 번 부른다. 마지막이 아닌 업체는 체인 제한 시간의 일부만 기다린다. */
  async #attempt<T>(
    adapter: AiProviderAdapter,
    model: AiProviderModel,
    request: AiGenerationRequest<T>,
    context: ChainContext & { readonly isLast: boolean },
  ): Promise<Attempt<T>> {
    const { policy, signal, cost, startedAt, isLast } = context;
    const remainingMs = Math.max(
      Math.floor(policy.deadlineMs - (performance.now() - startedAt)),
      1,
    );
    const attemptSignal = isLast
      ? signal
      : AbortSignal.any([
          signal,
          AbortSignal.timeout(
            Math.min(remainingMs, Math.floor(policy.deadlineMs * FRONT_PROVIDER_DEADLINE_SHARE)),
          ),
        ]);
    const inputChars = request.system.length + request.prompt.length;
    const providerPolicy = this.#providerPolicies.get(adapter.id);
    if (providerPolicy == null) {
      return { type: "skipped" };
    }
    try {
      const { generated, output } = await providerPolicy.execute(async () => {
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
            maxRetries: isLast ? policy.lastProviderMaxRetries : 0,
            abortSignal: attemptSignal,
            providerOptions: adapter.getProviderOptions(policy),
          });
          cost.add(
            estimateCostMicroUsd(model.id, generated.usage),
            estimateSpendMicroUsd({
              model: model.id,
              usage: generated.usage,
              inputChars,
              maxOutputTokens: policy.maxOutputTokens,
              timedOut: false,
            }),
          );
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
          const kind = attemptSignal.aborted ? "TIMEOUT" : adapter.classifyError(error);
          if (!counted) {
            const usage = readFailedUsage(error);
            cost.add(
              estimateCostMicroUsd(model.id, usage),
              estimateSpendMicroUsd({
                model: model.id,
                usage,
                inputChars,
                maxOutputTokens: policy.maxOutputTokens,
                timedOut: kind === "TIMEOUT",
              }),
            );
          }
          throw new AiAttemptFailure(kind, request.task, { cause: error });
        }
      }, attemptSignal);
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
          cachedInputTokens: generated.usage.inputTokenDetails.cacheReadTokens ?? 0,
          cacheWriteInputTokens: generated.usage.inputTokenDetails.cacheWriteTokens ?? 0,
          outputTokens: generated.usage.outputTokens ?? 0,
          reasoningTokens: generated.usage.outputTokenDetails.reasoningTokens ?? 0,
          estimatedCostMicroUsd: null,
          finishReason: generated.finishReason,
        },
      };
    } catch (error) {
      if (error instanceof OutboundRejectedError) {
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
      estimatedCostMicroUsd: context.cost.estimatedMicroUsd,
      upstream: last.failure.upstream,
    });
  }
}

/** 업체를 부르지 않고 끝난 실패 */
function withheld(kind: AiFailureKind): AiGenerationError {
  return new AiGenerationError(kind, {
    provider: null,
    attempts: 0,
    fallbackFrom: null,
    estimatedCostMicroUsd: 0,
    upstream: null,
  });
}

/** 같은 사용자의 같은 프롬프트가 동시에 들어오면(연타·재시도) 업체 호출 하나를 나눠 쓴다. */
function coalescingKey<T>(request: AiGenerationRequest<T>): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        request.userId,
        request.task,
        request.promptVersion,
        request.system,
        request.prompt,
      ]),
    )
    .digest("hex");
}
