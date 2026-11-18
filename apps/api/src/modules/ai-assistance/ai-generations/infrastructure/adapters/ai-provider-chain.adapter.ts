import { AI_DATA_SHARING_CONSENT, AI_PROVIDER_IDS, type AiProviderId } from "@aido/api/vocabulary";
import type { Logger } from "@nestjs/common";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import type { AiAssistanceAiGenerationsConfig } from "../../ai-assistance-ai-generations.config.js";
import { AiGenerationAlerts } from "../../application/ai-generations.alerts.js";
import {
  aiGenerationFailed,
  type AiGenerationError,
  type AiFailureKind,
  resolveAiFailureRule,
} from "../../application/ai-generations.errors.js";
import { AiGenerationLogEvent } from "../../application/ai-generations.log-events.js";
import type {
  AiGenerationRequest,
  AiTaskId,
  AiTaskOutputs,
} from "../../application/ports/ai-generator.port.js";
import { AiGeneration } from "../../domain/ai-generation.aggregate.js";
import { planAiRoute } from "../../domain/ai-route.domain-service.js";
import type { AiGenerationCostMeter } from "./ai-generation-cost.mapper.js";
import {
  type AiChainContext,
  type AiFailedAttempt,
  attemptProvider,
} from "./ai-provider-attempt.adapter.js";
import type { AiProviderCatalog } from "./ai-provider.adapter.js";

/** 사람이 키·요청을 확인해야 하는 실패. 다음 업체로 넘기면서 error로 남긴다. */
const OPERATOR_FAILURES: ReadonlySet<AiFailureKind> = new Set(["AUTH", "BAD_REQUEST"]);

/** 스키마 불일치(shouldRetrySameProvider)는 첫 업체에만 한 번 더 묻는다. */
const MAX_CALLS_PER_PROVIDER = 2;

interface LastFailure {
  readonly provider: AiProviderId | null;
  readonly failure: AiFailedAttempt;
}

interface AiProviderChainDependencies {
  readonly config: Pick<AiAssistanceAiGenerationsConfig, "providerOrder" | "providerTimeWeights">;
  readonly providers: AiProviderCatalog;
  readonly providerPolicies: ReadonlyMap<AiProviderId, OutboundPolicy>;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly logger: Pick<Logger, "warn" | "error">;
}

/**
 * 업체를 설정 순서 → 동의 범위 → 열린 회로 제외로 고르고 차례로 시도한다. 첫 업체만 출력 재질문을 한 번 더
 * 하고, 대체할 실패면 다음 업체로 넘기며, 모두 실패하면 마지막 실패 종류로 끝낸다.
 */
export class AiProviderChain {
  readonly #dependencies: AiProviderChainDependencies;

  constructor(dependencies: AiProviderChainDependencies) {
    this.#dependencies = dependencies;
  }

  async run<TTask extends AiTaskId>(
    request: AiGenerationRequest<TTask>,
    context: AiChainContext,
  ): Promise<AiGeneration<AiTaskOutputs[TTask]>> {
    const { providers, providerPolicies, config } = this.#dependencies;
    const { policy, signal, cost } = context;
    const route = planAiRoute({
      ...this.#routeInput(request),
      openCircuits: new Set(
        AI_PROVIDER_IDS.filter((provider) => providerPolicies.get(provider)?.isOpen()),
      ),
    });
    let attempts = 0;
    let last: LastFailure | null = null;

    for (const [index, provider] of route.entries()) {
      const adapter = providers.find(provider);
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
        const attempt = await attemptProvider(request, {
          ...context,
          adapter,
          model,
          providerPolicy: providerPolicies.get(provider),
          route,
          weights: config.providerTimeWeights,
          isLast,
        });
        if (attempt.type === "succeeded") {
          return AiGeneration.create({
            ...attempt.result,
            route,
            provider,
            attempts,
            estimatedCostMicroUsd: cost.estimatedMicroUsd,
          });
        }
        if (attempt.type === "skipped") {
          attempts--;
          break;
        }
        last = { provider, failure: attempt.failure };
        const rule = resolveAiFailureRule(attempt.failure.kind);
        if (!rule.shouldFallback || signal.aborted) {
          throw toChainFailure(last, { attempts, route, cost });
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
        this.#logFallback(request.task, { from: provider, to: next, failure: last.failure });
      }
    }

    if (signal.aborted) {
      const timeout = { kind: "TIMEOUT", upstream: { errorType: "TimeoutError" } } as const;
      throw toChainFailure(
        { provider: last?.provider ?? null, failure: timeout },
        { attempts, route, cost },
      );
    }
    if (last == null) {
      throw this.#noProviderFailure(request, { attempts, cost });
    }
    throw toChainFailure(last, { attempts, route, cost });
  }

  #routeInput(request: AiGenerationRequest<AiTaskId>) {
    return {
      order: this.#dependencies.config.providerOrder,
      configured: new Set(
        this.#dependencies.providers
          .list()
          .filter((adapter) => adapter.getModel(request.task) != null)
          .map((adapter) => adapter.id),
      ),
      agreedVersion: request.agreedConsentVersion,
    };
  }

  /** 한 번도 부르지 못하고 끝났다. 회로가 모두 열렸는지, 보낼 업체가 아예 없는지 나눠 알린다 */
  #noProviderFailure(
    request: AiGenerationRequest<AiTaskId>,
    chain: { readonly attempts: number; readonly cost: AiGenerationCostMeter },
  ): AiGenerationError {
    const { alert } = this.#dependencies;
    const routeInput = this.#routeInput(request);
    const hasEligibleProvider = planAiRoute({ ...routeInput, openCircuits: new Set() }).length > 0;
    // 최신 동의 버전은 모든 업체를 허용해 동의와 무관하게 키가 설정된 업체가 있는지 본다
    const hasConfiguredProvider =
      planAiRoute({
        ...routeInput,
        agreedVersion: AI_DATA_SHARING_CONSENT.VERSION,
        openCircuits: new Set(),
      }).length > 0;
    const tags = { task: request.task, taskClass: request.taskClass };
    // 업체별 회로 경보와 따로, AI 기능 전체가 멈춘 것은 이 경보 하나로 본다
    if (hasEligibleProvider) {
      alert.raise({ ...AiGenerationAlerts.ALL_PROVIDERS_CIRCUIT_OPEN, tags });
    }
    // 동의 범위 때문에 업체가 없는 것은 사용자 상태라 경보하지 않고 설정 누락만 올린다
    if (!hasConfiguredProvider) {
      alert.raise({ ...AiGenerationAlerts.NO_PROVIDER_AVAILABLE, tags });
    }
    return aiGenerationFailed(hasEligibleProvider ? "CIRCUIT_OPEN" : "UNAVAILABLE", {
      provider: null,
      attempts: chain.attempts,
      fallbackFrom: null,
      estimatedCostMicroUsd: chain.cost.estimatedMicroUsd,
      upstream: null,
    });
  }

  #logFallback(
    task: AiTaskId,
    fallback: {
      readonly from: AiProviderId;
      readonly to: AiProviderId;
      readonly failure: AiFailedAttempt;
    },
  ): void {
    const { from, to, failure } = fallback;
    const event = {
      event: AiGenerationLogEvent.PROVIDER_FALLBACK,
      task,
      from,
      to,
      errorType: failure.kind,
      ...(failure.upstream.statusCode != null && { statusCode: failure.upstream.statusCode }),
    };
    if (OPERATOR_FAILURES.has(failure.kind)) {
      this.#dependencies.logger.error(event);
      return;
    }
    this.#dependencies.logger.warn(event);
  }
}

function toChainFailure(
  last: LastFailure,
  chain: {
    readonly attempts: number;
    readonly route: readonly AiProviderId[];
    readonly cost: AiGenerationCostMeter;
  },
): AiGenerationError {
  const first = chain.route[0] ?? null;
  return aiGenerationFailed(last.failure.kind, {
    provider: last.provider,
    attempts: chain.attempts,
    fallbackFrom: last.provider != null && last.provider !== first ? first : null,
    estimatedCostMicroUsd: chain.cost.estimatedMicroUsd,
    upstream: last.failure.upstream,
  });
}
