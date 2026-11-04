import type { AiProviderId } from "@aido/api/vocabulary";
import type { LanguageModel, SystemModelMessage } from "ai";

import type { AiFailureKind } from "../../../../application/ports/generation/ai-generation.errors.js";
import type { AiTaskId } from "../../../../application/ports/generation/ai-generator.port.js";
import type { AiGenerationPolicy } from "../ai-generation-policy.js";

export type AiProviderOptions = NonNullable<SystemModelMessage["providerOptions"]>;

export interface AiProviderModel {
  /** `<provider>:<model>` */
  readonly id: string;
  readonly model: LanguageModel;
}

/**
 * 업체별 모델·옵션·오류 해석 전략. 업체 고유 옵션과 오류 본문 해석은 이 구현 안에만 둔다.
 * 생성 체인(AiSdkGenerator)은 업체를 몰라도 같은 방식으로 시도·폴백한다.
 */
export interface AiProviderAdapter {
  readonly id: AiProviderId;
  /** API 키가 없으면 null이며 그 업체는 경로에서 빠진다. */
  getModel(task: AiTaskId): AiProviderModel | null;
  getProviderOptions(policy: AiGenerationPolicy): AiProviderOptions;
  /** 고정 지시문에 붙일 업체 옵션(예: 프롬프트 캐시). 없으면 undefined */
  getSystemProviderOptions(system: string): AiProviderOptions | undefined;
  classifyError(error: unknown): AiFailureKind;
}

export const AI_PROVIDER_ADAPTERS = Symbol("AI_PROVIDER_ADAPTERS");
