import type { AiProviderId } from "@aido/api/vocabulary";
import { omit } from "es-toolkit";

import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { AiGenerationId } from "./ai-generation-id.vo.js";
import { invalidAiGeneration } from "./ai-generations.errors.js";

export interface AiGenerationUsage {
  /** 입력 토큰 전체(캐시 읽기·쓰기 포함) */
  readonly inputTokens: number;
  /** 입력 토큰 중 프롬프트 캐시에서 읽은 수 */
  readonly cachedInputTokens: number;
  /** 입력 토큰 중 프롬프트 캐시에 새로 쓴 수 */
  readonly cacheWriteInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
}

/** 생성 결과의 출력 밖 값. 토큰은 응답한 호출의 값이고, 비용은 이 요청의 모든 시도를 더한 추정값이다. */
export interface AiGenerationMeta extends AiGenerationUsage {
  readonly provider: AiProviderId;
  /** `<provider>:<model>` (예: anthropic:claude-haiku-5-5) */
  readonly model: string;
  /** 모델을 부른 횟수(대체 업체·출력 재시도 포함) */
  readonly attempts: number;
  /** 첫 업체가 실패해 다른 업체가 응답했으면 첫 업체 */
  readonly fallbackFrom: AiProviderId | null;
  readonly latencyMs: number;
  /** 모든 시도의 토큰 × 모델 단가. 단가를 모르는 모델을 썼으면 null */
  readonly estimatedCostMicroUsd: number | null;
  readonly finishReason: string;
}

export interface AiGenerationPrimitives<TOutput> extends AiGenerationMeta {
  readonly id: string;
  readonly output: TOutput;
  /** 이 요청이 차례로 시도한 처리 업체 */
  readonly route: readonly AiProviderId[];
}

interface AiGenerationProps<TOutput> extends AiGenerationMeta {
  readonly output: TOutput;
  readonly route: readonly AiProviderId[];
}

export type CreateAiGenerationParams<TOutput> = Omit<
  AiGenerationPrimitives<TOutput>,
  "id" | "fallbackFrom"
>;

/**
 * 스키마에 맞는 출력을 낸 생성 한 건. 저장하지 않고 정규화·로그에만 쓴다.
 * 응답한 업체는 시도 경로 안에 있어야 하고, 경로의 첫 업체가 아니면 그 업체에서 넘어온 것이다.
 */
export class AiGeneration<TOutput> extends AggregateRoot<
  AiGenerationId,
  AiGenerationProps<TOutput>
> {
  static create<TOutput>(params: CreateAiGenerationParams<TOutput>): AiGeneration<TOutput> {
    const { output, route, provider, attempts, latencyMs, estimatedCostMicroUsd } = params;
    if (output == null) {
      throw invalidAiGeneration("generation must have an output");
    }
    if (!route.includes(provider)) {
      throw invalidAiGeneration("responding provider must be on the route");
    }
    if (!Number.isInteger(attempts) || attempts < 1) {
      throw invalidAiGeneration("generation must count at least one attempt");
    }
    if (latencyMs < 0 || (estimatedCostMicroUsd != null && estimatedCostMicroUsd < 0)) {
      throw invalidAiGeneration("latency and cost must not be negative");
    }
    const first = route[0] ?? null;
    return new AiGeneration(AiGenerationId.generate(), {
      output,
      route: [...route],
      provider,
      model: params.model,
      attempts,
      fallbackFrom: provider === first ? null : first,
      latencyMs,
      inputTokens: params.inputTokens,
      cachedInputTokens: params.cachedInputTokens,
      cacheWriteInputTokens: params.cacheWriteInputTokens,
      outputTokens: params.outputTokens,
      reasoningTokens: params.reasoningTokens,
      estimatedCostMicroUsd,
      finishReason: params.finishReason,
    });
  }

  get output(): TOutput {
    return this.props.output;
  }

  get provider(): AiProviderId {
    return this.props.provider;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get fallbackFrom(): AiProviderId | null {
    return this.props.fallbackFrom;
  }

  get latencyMs(): number {
    return this.props.latencyMs;
  }

  get estimatedCostMicroUsd(): number | null {
    return this.props.estimatedCostMicroUsd;
  }

  get meta(): AiGenerationMeta {
    return omit(this.props, ["output", "route"]);
  }

  toPrimitives(): AiGenerationPrimitives<TOutput> {
    return { ...this.props, id: this.id.value, route: [...this.props.route] };
  }
}
