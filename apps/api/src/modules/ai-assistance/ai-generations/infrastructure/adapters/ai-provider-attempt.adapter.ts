import type { AiProviderId } from "@aido/api/vocabulary";
import { generateText } from "ai";

import type { OutboundPolicy } from "#api/platform/resilience/outbound-policy";
import { OutboundRejectedError } from "#api/platform/resilience/outbound-policy.errors";

import {
  aiAttemptFailed,
  AiAttemptFailure,
  type AiFailureKind,
  type AiUpstreamCause,
} from "../../application/ai-generations.errors.js";
import type {
  AiGenerationRequest,
  AiTaskId,
  AiTaskOutputs,
} from "../../application/ports/ai-generator.port.js";
import type { AiGenerationUsage } from "../../domain/ai-generation.aggregate.js";
import {
  type AiProviderTimeWeights,
  resolveAttemptTime,
} from "../../domain/ai-route.domain-service.js";
import type { AiGenerationCostMeter } from "./ai-generation-cost.mapper.js";
import type { AiGenerationPolicy } from "./ai-generation-policy.constants.js";
import type { AiProviderAdapter, AiProviderModel } from "./ai-provider.adapter.js";
import { describeUpstreamCause, readFailedUsage } from "./ai-sdk-failure.mapper.js";
import { toGenerateTextOptions } from "./ai-sdk-request.mapper.js";
import { findUnusableFinish, toGenerationUsage } from "./ai-sdk-response.mapper.js";
import { AI_TASK_OUTPUT_SCHEMAS } from "./ai-task-output.wire.js";

interface AiSucceededAttempt<TOutput> extends AiGenerationUsage {
  readonly output: TOutput;
  readonly model: string;
  readonly latencyMs: number;
  readonly finishReason: string;
}

export interface AiFailedAttempt {
  readonly kind: AiFailureKind;
  readonly upstream: AiUpstreamCause;
}

export type AiProviderAttemptResult<TOutput> =
  | { readonly type: "succeeded"; readonly result: AiSucceededAttempt<TOutput> }
  | { readonly type: "failed"; readonly failure: AiFailedAttempt }
  /** 경로를 고른 뒤 회로가 열려 부르지 않았다 */
  | { readonly type: "skipped" };

/** 체인 하나가 시도마다 함께 쓰는 값. startedAt은 체인이 대기열을 지난 시각(performance.now)이다 */
export interface AiChainContext {
  readonly policy: AiGenerationPolicy;
  readonly signal: AbortSignal;
  readonly startedAt: number;
  readonly cost: AiGenerationCostMeter;
}

export interface AiProviderAttemptContext extends AiChainContext {
  readonly adapter: AiProviderAdapter;
  readonly model: AiProviderModel;
  /** 이 업체의 회로 정책. 없으면 부르지 않는다 */
  readonly providerPolicy: OutboundPolicy | undefined;
  readonly route: readonly AiProviderId[];
  readonly weights: AiProviderTimeWeights;
  readonly isLast: boolean;
}

/** 한 업체를 한 번 부른다. 마지막이 아닌 업체는 남은 시간 중 자기 몫만 기다린다. */
export async function attemptProvider<TTask extends AiTaskId>(
  request: AiGenerationRequest<TTask>,
  context: AiProviderAttemptContext,
): Promise<AiProviderAttemptResult<AiTaskOutputs[TTask]>> {
  const { policy, signal, startedAt, route, isLast, adapter, providerPolicy, weights } = context;
  const { budgetMs, hadFullShare } = resolveAttemptTime({
    route,
    provider: adapter.id,
    isLast,
    deadlineMs: policy.deadlineMs,
    remainingMs: Math.max(Math.floor(policy.deadlineMs - (performance.now() - startedAt)), 1),
    weights,
  });
  const attemptSignal = isLast
    ? signal
    : AbortSignal.any([signal, AbortSignal.timeout(Math.max(budgetMs, 1))]);
  if (providerPolicy == null) {
    return { type: "skipped" };
  }
  try {
    const result = await providerPolicy.execute(
      () => callProvider(request, { ...context, attemptSignal, hadFullShare }),
      attemptSignal,
    );
    return { type: "succeeded", result };
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

/** 회로 정책 안에서 업체를 부른다. 실패는 회로가 셀 종류를 담은 AiAttemptFailure로 던진다 */
async function callProvider<TTask extends AiTaskId>(
  request: AiGenerationRequest<TTask>,
  context: AiProviderAttemptContext & {
    readonly attemptSignal: AbortSignal;
    readonly hadFullShare: boolean;
  },
): Promise<AiSucceededAttempt<AiTaskOutputs[TTask]>> {
  const { adapter, model, policy, cost, startedAt, isLast, attemptSignal, hadFullShare } = context;
  const usage = {
    model: model.id,
    inputChars: request.system.length + request.prompt.length,
    maxOutputTokens: policy.maxOutputTokens,
  };
  let counted = false;
  try {
    const generated = await generateText(
      toGenerateTextOptions({
        adapter,
        model,
        request,
        schema: AI_TASK_OUTPUT_SCHEMAS[request.task],
        policy,
        isLast,
        abortSignal: attemptSignal,
      }),
    );
    cost.addAttempt({ ...usage, usage: generated.usage, timedOut: false });
    counted = true;
    const unusable = findUnusableFinish(generated);
    if (unusable != null) {
      throw aiAttemptFailed({ kind: unusable, task: request.task });
    }
    return {
      output: generated.output,
      model: model.id,
      latencyMs: Math.round(performance.now() - startedAt),
      finishReason: generated.finishReason,
      ...toGenerationUsage(generated.usage),
    };
  } catch (error) {
    if (error instanceof AiAttemptFailure) {
      throw error;
    }
    const kind = attemptSignal.aborted ? "TIMEOUT" : adapter.classifyError(error);
    if (!counted) {
      cost.addAttempt({ ...usage, usage: readFailedUsage(error), timedOut: kind === "TIMEOUT" });
    }
    const callerAborted = request.signal?.aborted === true;
    throw aiAttemptFailed({
      kind,
      task: request.task,
      cause: error,
      countsAgainstProvider: kind !== "TIMEOUT" || (hadFullShare && !callerAborted),
    });
  }
}
