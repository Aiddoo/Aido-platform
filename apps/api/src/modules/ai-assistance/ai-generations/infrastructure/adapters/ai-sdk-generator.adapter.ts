import { createHash } from "node:crypto";

import { AI_PROVIDER_IDS } from "@aido/api/vocabulary";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundRejectedError } from "#api/platform/resilience/outbound-policy.errors";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import {
  type AiAssistanceAiGenerationsConfig,
  aiAssistanceAiGenerationsConfig,
} from "../../ai-assistance-ai-generations.config.js";
import {
  AiGenerationError,
  aiGenerationWithheld,
} from "../../application/ai-generations.errors.js";
import { AiGenerationLogEvent } from "../../application/ai-generations.log-events.js";
import {
  type AiGenerationRequest,
  AiGeneratorPort,
  type AiTaskId,
  type AiTaskOutputs,
} from "../../application/ports/ai-generator.port.js";
import { AiGeneration } from "../../domain/ai-generation.aggregate.js";
import type { AiTaskClass } from "../../domain/ai-spend.domain-service.js";
import { AiGenerationCostMeter } from "./ai-generation-cost.mapper.js";
import { resolveGenerationPolicy } from "./ai-generation-policy.constants.js";
import { AiProviderChain } from "./ai-provider-chain.adapter.js";
import { AI_TASK_CLASS_POLICIES, createAiProviderPolicy } from "./ai-provider-outbound.policy.js";
import { AiProviderCatalog } from "./ai-provider.adapter.js";
import { AiSpendBudgetAdapter } from "./ai-spend-budget.adapter.js";
import { AI_TASK_OUTPUT_SCHEMAS } from "./ai-task-output.wire.js";

type GeneratorConfig = Pick<
  AiAssistanceAiGenerationsConfig,
  "breaker" | "tasks" | "providerOrder" | "providerTimeWeights"
>;

/**
 * 입력 상한 → 킬 스위치·비용 예산 → 같은 요청 합치기 → 작업 분류 bulkhead → 업체 체인 순서로 생성한다.
 * 업체는 설정 순서 → 동의 범위 → 열린 회로 제외로 고르고, 앞 업체는 SDK 재시도 없이 남은 시간 중 자기 몫만
 * 기다린 뒤 넘긴다. 끝나면 이번 요청의 추정 비용을 예산에 한 번 더한다.
 */
@Injectable()
export class AiSdkGeneratorAdapter extends AiGeneratorPort {
  readonly #logger = new Logger(AiSdkGeneratorAdapter.name);
  readonly #classPolicies: Readonly<Record<AiTaskClass, OutboundPolicy>>;
  readonly #inflight = new Map<string, Promise<AiGeneration<unknown>>>();
  readonly #config: GeneratorConfig;
  readonly #spend: AiSpendBudgetAdapter;
  readonly #chain: AiProviderChain;

  constructor(
    @Inject(aiAssistanceAiGenerationsConfig.KEY) config: GeneratorConfig,
    providers: AiProviderCatalog,
    policies: OutboundPolicyRegistry,
    spend: AiSpendBudgetAdapter,
    alert: OperationalAlertPort,
  ) {
    super();
    this.#config = config;
    this.#spend = spend;
    this.#chain = new AiProviderChain({
      config,
      providers,
      providerPolicies: new Map(
        AI_PROVIDER_IDS.map((provider) => [
          provider,
          policies.get(createAiProviderPolicy(provider, config.breaker)),
        ]),
      ),
      alert,
      logger: this.#logger,
    });
    this.#classPolicies = {
      interactive: policies.get(AI_TASK_CLASS_POLICIES.interactive),
      background: policies.get(AI_TASK_CLASS_POLICIES.background),
    };
  }

  async generate<TTask extends AiTaskId>(
    request: AiGenerationRequest<TTask>,
  ): Promise<AiGeneration<AiTaskOutputs[TTask]>> {
    this.#assertInputSize(request);
    await this.#assertSpendAllowed(request);

    const schema = AI_TASK_OUTPUT_SCHEMAS[request.task];
    const key = buildCoalescingKey(request);
    const shared = this.#inflight.get(key);
    if (shared != null) {
      const generation = (await shared).toPrimitives();
      return AiGeneration.create({ ...generation, output: schema.parse(generation.output) });
    }
    const pending = this.#generateOnce(request);
    this.#inflight.set(key, pending);
    try {
      return await pending;
    } finally {
      this.#inflight.delete(key);
    }
  }

  #assertInputSize(request: AiGenerationRequest<AiTaskId>): void {
    const inputChars = request.prompt.length;
    if (inputChars <= request.maxInputChars) {
      return;
    }
    this.#logger.error({
      event: AiGenerationLogEvent.INPUT_REJECTED,
      task: request.task,
      inputChars,
      maxInputChars: request.maxInputChars,
    });
    throw aiGenerationWithheld("BAD_REQUEST");
  }

  async #assertSpendAllowed(request: AiGenerationRequest<AiTaskId>): Promise<void> {
    const decision = await this.#spend.decide({
      taskClass: request.taskClass,
      userId: request.userId,
    });
    if (decision.type === "allowed") {
      return;
    }
    if (decision.type === "halted") {
      this.#logger.warn({
        event: AiGenerationLogEvent.SPEND_HALTED,
        task: request.task,
        taskClass: request.taskClass,
        reason: decision.reason,
      });
      throw aiGenerationWithheld("HALTED");
    }
    this.#logger.warn({
      event: AiGenerationLogEvent.SPEND_USER_LIMITED,
      task: request.task,
      userId: request.userId?.value ?? null,
    });
    throw aiGenerationWithheld("USER_SPEND_LIMITED");
  }

  async #generateOnce<TTask extends AiTaskId>(
    request: AiGenerationRequest<TTask>,
  ): Promise<AiGeneration<AiTaskOutputs[TTask]>> {
    const settings = this.#config.tasks[request.task];
    const policy = resolveGenerationPolicy(request.task, request.taskClass, settings);
    const cost = new AiGenerationCostMeter();
    const chainSignals: AbortSignal[] = [];
    try {
      return await this.#classPolicies[request.taskClass].execute(() => {
        // 제한 시간은 업체 체인의 몫이라 대기열을 지난 뒤부터 잰다. 대기 중 끊기면 호출자 신호가 취소한다.
        const deadline = AbortSignal.timeout(policy.deadlineMs);
        const signal =
          request.signal == null ? deadline : AbortSignal.any([deadline, request.signal]);
        chainSignals.push(signal);
        return this.#chain.run(request, { policy, signal, startedAt: performance.now(), cost });
      }, request.signal);
    } catch (error) {
      if (error instanceof OutboundRejectedError) {
        throw aiGenerationWithheld("RATE_LIMITED");
      }
      const aborted =
        request.signal?.aborted === true || chainSignals.some((signal) => signal.aborted);
      if (!(error instanceof AiGenerationError) && aborted) {
        throw aiGenerationWithheld("TIMEOUT");
      }
      throw error;
    } finally {
      await this.#spend.record(request.userId, cost.spendMicroUsd);
    }
  }
}

/** 같은 사용자의 같은 프롬프트가 동시에 들어오면(연타·재시도) 업체 호출 하나를 나눠 쓴다. */
function buildCoalescingKey(request: AiGenerationRequest<AiTaskId>): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        request.userId?.value ?? null,
        request.task,
        request.promptVersion,
        request.system,
        request.prompt,
      ]),
    )
    .digest("hex");
}
