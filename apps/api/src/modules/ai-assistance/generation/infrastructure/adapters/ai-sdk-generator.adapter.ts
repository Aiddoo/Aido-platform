import { createHash } from "node:crypto";

import { AI_PROVIDER_IDS, type AiProviderId } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { generateText, Output } from "ai";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundRejectedError } from "#api/platform/resilience/outbound-policy.errors";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import {
  type AiAssistanceGenerationConfig,
  aiAssistanceGenerationConfig,
} from "../../ai-assistance-generation.config.js";
import { AiAlerts } from "../../application/ai-generation.alerts.js";
import {
  AiGenerationError,
  type AiFailureKind,
  type AiUpstreamCause,
  resolveAiFailureRule,
} from "../../application/ai-generation.errors.js";
import {
  type AiGenerationRequest,
  type AiGenerationResult,
  AiGeneratorPort,
} from "../../application/ports/ai-generator.port.js";
import { planAiRoute, resolveAttemptTime } from "../../domain/ai-route.domain-service.js";
import { type AiTaskClass } from "../../domain/ai-spend.domain-service.js";
import {
  type AiGenerationPolicy,
  resolveGenerationPolicy,
} from "./ai-generation-policy.constants.js";
import { estimateCostMicroUsd, estimateSpendMicroUsd } from "./ai-model-pricing.constants.js";
import {
  AI_TASK_CLASS_POLICIES,
  AiAttemptFailure,
  createAiProviderPolicy,
} from "./ai-provider-outbound.policy.js";
import {
  type AiProviderAdapter,
  AiProviderCatalog,
  type AiProviderModel,
} from "./ai-provider.adapter.js";
import { AiGuardLogEvent, AiProviderLogEvent } from "./ai-provider.log-events.js";
import {
  describeUpstreamCause,
  readFailedUsage,
  withoutRetryOnBillingFailure,
} from "./ai-sdk-failure.mapper.js";
import { AiSpendBudgetAdapter } from "./ai-spend-budget.adapter.js";

/** 사람이 키·요청을 확인해야 하는 실패. 다음 업체로 넘기면서 error로 남긴다. */
const OPERATOR_FAILURES: ReadonlySet<AiFailureKind> = new Set(["AUTH", "BAD_REQUEST"]);

type GeneratorConfig = Pick<AiAssistanceGenerationConfig, "breaker" | "tasks" | "providerOrder">;

/** 스키마 불일치(shouldRetrySameProvider)는 첫 업체에만 한 번 더 묻는다. */
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
 * 업체는 설정 순서 → 동의 범위 → 열린 회로 제외로 고르고, 앞 업체는 SDK 재시도 없이 남은 시간 중 자기 몫만
 * 기다린 뒤 넘긴다. 끝나면 이번 요청의 추정 비용을 예산에 한 번 더한다.
 */
@Injectable()
export class AiSdkGeneratorAdapter extends AiGeneratorPort {
  readonly #logger = new Logger(AiSdkGeneratorAdapter.name);
  readonly #providers: AiProviderCatalog;
  readonly #providerPolicies: ReadonlyMap<AiProviderId, OutboundPolicy>;
  readonly #classPolicies: Readonly<Record<AiTaskClass, OutboundPolicy>>;
  readonly #inflight = new Map<string, Promise<AiGenerationResult<unknown>>>();

  readonly #config: GeneratorConfig;
  readonly #spend: AiSpendBudgetAdapter;
  readonly #alert: Pick<OperationalAlertPort, "raise">;

  constructor(
    @Inject(aiAssistanceGenerationConfig.KEY) config: GeneratorConfig,
    providers: AiProviderCatalog,
    policies: OutboundPolicyRegistry,
    spend: AiSpendBudgetAdapter,
    alert: OperationalAlertPort,
  ) {
    super();
    this.#config = config;
    this.#spend = spend;
    this.#alert = alert;
    this.#providers = providers;
    this.#providerPolicies = new Map(
      AI_PROVIDER_IDS.map((provider) => [
        provider,
        policies.get(createAiProviderPolicy(provider, config.breaker)),
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

    const key = buildCoalescingKey(request);
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
    throw createWithheldError("BAD_REQUEST");
  }

  async #assertSpendAllowed<T>(request: AiGenerationRequest<T>): Promise<void> {
    const decision = await this.#spend.decide({
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
      throw createWithheldError("HALTED");
    }
    this.#logger.warn({
      event: AiGuardLogEvent.SPEND_USER_LIMITED,
      task: request.task,
      userId: request.userId,
    });
    throw createWithheldError("USER_SPEND_LIMITED");
  }

  async #generateOnce<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>> {
    const settings = this.#config.tasks[request.task];
    const policy = resolveGenerationPolicy(request.task, request.taskClass, settings);
    const cost = new CostMeter();
    const chainSignals: AbortSignal[] = [];
    try {
      return await this.#classPolicies[request.taskClass].execute(() => {
        // 제한 시간은 업체 체인의 몫이라 대기열을 지난 뒤부터 잰다. 대기 중 끊기면 호출자 신호가 취소한다.
        const deadline = AbortSignal.timeout(policy.deadlineMs);
        const signal =
          request.signal == null ? deadline : AbortSignal.any([deadline, request.signal]);
        chainSignals.push(signal);
        return this.#chain(request, { policy, signal, startedAt: performance.now(), cost });
      }, request.signal);
    } catch (error) {
      if (error instanceof OutboundRejectedError) {
        throw createWithheldError("RATE_LIMITED");
      }
      const aborted =
        request.signal?.aborted === true || chainSignals.some((signal) => signal.aborted);
      if (!(error instanceof AiGenerationError) && aborted) {
        throw createWithheldError("TIMEOUT");
      }
      throw error;
    } finally {
      await this.#spend.record(request.userId, cost.spendMicroUsd);
    }
  }

  async #chain<T>(
    request: AiGenerationRequest<T>,
    context: ChainContext,
  ): Promise<AiGenerationResult<T>> {
    const { policy, signal, cost } = context;
    const routeInput = {
      order: this.#config.providerOrder,
      configured: new Set(
        this.#providers
          .list()
          .filter((adapter) => adapter.getModel(request.task) != null)
          .map((adapter) => adapter.id),
      ),
      agreedVersion: request.agreedConsentVersion,
    };
    const route = planAiRoute({
      ...routeInput,
      openCircuits: new Set(
        AI_PROVIDER_IDS.filter((provider) => this.#providerPolicies.get(provider)?.isOpen()),
      ),
    });
    let attempts = 0;
    let last: { provider: AiProviderId; failure: AiFailedAttempt } | null = null;

    for (const [index, provider] of route.entries()) {
      const adapter = this.#providers.find(provider);
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
        const attempt = await this.#attempt(adapter, model, request, {
          ...context,
          route,
          isLast,
        });
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
        if (!rule.shouldFallback || signal.aborted) {
          throw this.#failed(last, { attempts, route, cost });
        }
        if (!rule.shouldRetrySameProvider) {
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
      const hasEligibleProvider =
        planAiRoute({ ...routeInput, openCircuits: new Set() }).length > 0;
      // 업체별 회로 경보와 따로, AI 기능 전체가 멈춘 것은 이 경보 하나로 본다
      this.#alert.raise({
        ...(hasEligibleProvider
          ? AiAlerts.ALL_PROVIDERS_CIRCUIT_OPEN
          : AiAlerts.NO_PROVIDER_AVAILABLE),
        tags: { task: request.task, taskClass: request.taskClass },
      });
      throw new AiGenerationError(hasEligibleProvider ? "CIRCUIT_OPEN" : "UNAVAILABLE", {
        provider: null,
        attempts,
        fallbackFrom: null,
        estimatedCostMicroUsd: cost.estimatedMicroUsd,
        upstream: null,
      });
    }
    throw this.#failed(last, { attempts, route, cost });
  }

  /** 한 업체를 한 번 부른다. 마지막이 아닌 업체는 남은 시간 중 자기 몫만 기다린다. */
  async #attempt<T>(
    adapter: AiProviderAdapter,
    model: AiProviderModel,
    request: AiGenerationRequest<T>,
    context: ChainContext & {
      readonly route: readonly AiProviderId[];
      readonly isLast: boolean;
    },
  ): Promise<Attempt<T>> {
    const { policy, signal, cost, startedAt, route, isLast } = context;
    const { budgetMs, hadFullShare } = resolveAttemptTime({
      route,
      provider: adapter.id,
      isLast,
      deadlineMs: policy.deadlineMs,
      remainingMs: Math.max(Math.floor(policy.deadlineMs - (performance.now() - startedAt)), 1),
    });
    const attemptSignal = isLast
      ? signal
      : AbortSignal.any([signal, AbortSignal.timeout(Math.max(budgetMs, 1))]);
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
            model: withoutRetryOnBillingFailure(model.model, (error) =>
              adapter.classifyError(error),
            ),
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
          // 추론이 출력 상한을 다 쓰면 본문 없이 끝나 SDK는 output 접근에서 스키마 오류처럼 실패한다.
          if (generated.finishReason === "length" && generated.text.trim() === "") {
            throw new AiAttemptFailure("TRUNCATED", request.task, {});
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
          const callerAborted = request.signal?.aborted === true;
          throw new AiAttemptFailure(
            kind,
            request.task,
            { cause: error },
            kind !== "TIMEOUT" || (hadFullShare && !callerAborted),
          );
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
function createWithheldError(kind: AiFailureKind): AiGenerationError {
  return new AiGenerationError(kind, {
    provider: null,
    attempts: 0,
    fallbackFrom: null,
    estimatedCostMicroUsd: 0,
    upstream: null,
  });
}

/** 같은 사용자의 같은 프롬프트가 동시에 들어오면(연타·재시도) 업체 호출 하나를 나눠 쓴다. */
function buildCoalescingKey<T>(request: AiGenerationRequest<T>): string {
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
