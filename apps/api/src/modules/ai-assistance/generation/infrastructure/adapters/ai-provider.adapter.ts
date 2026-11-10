import type { AiProviderId } from "@aido/api/vocabulary";
import type { LanguageModel, SystemModelMessage } from "ai";

import type { AiFailureKind } from "../../application/ai-generation.errors.js";
import type { AiTaskId } from "../../application/ports/ai-generator.port.js";
import type { AiGenerationPolicy } from "./ai-generation-policy.constants.js";

export type AiProviderOptions = NonNullable<SystemModelMessage["providerOptions"]>;

/** 전역 provider 문자열 ID를 쓰지 않으므로 모델 객체만 받는다. */
export type AiLanguageModel = Exclude<LanguageModel, string>;

export interface AiProviderModel {
  /** `<provider>:<model>` */
  readonly id: string;
  readonly model: AiLanguageModel;
}

/**
 * 업체가 사용자 글자를 어떻게 다루는지. 앱 개인정보 문구(국외 이전)와 docs/ai.md의 업체 표가 이 값을 따른다.
 * 학습에 쓰는 업체는 체인에 넣지 않으므로 trainsOnUserData는 false만 허용한다.
 */
export interface AiProviderDataHandling {
  readonly trainsOnUserData: false;
  /** 요청마다 업체 응답 저장을 끄는 옵션을 보내는지(OpenAI store: false) */
  readonly disablesResponseStorage: boolean;
  /** 학습 제외의 근거가 되는 계정·키 조건 */
  readonly basis: string;
}

/**
 * 업체별 모델·옵션·오류 해석 전략. 업체 고유 옵션과 오류 본문 해석은 이 구현 안에만 둔다.
 * 생성 체인(AiSdkGeneratorAdapter)은 업체를 몰라도 같은 방식으로 시도·폴백한다.
 */
export abstract class AiProviderAdapter {
  abstract readonly id: AiProviderId;
  abstract readonly dataHandling: AiProviderDataHandling;
  /** API 키가 없으면 null이며 그 업체는 경로에서 빠진다. */
  abstract getModel(task: AiTaskId): AiProviderModel | null;
  abstract getProviderOptions(policy: AiGenerationPolicy): AiProviderOptions;
  /** 고정 지시문에 붙일 업체 옵션(예: 프롬프트 캐시). 없으면 undefined */
  abstract getSystemProviderOptions(system: string): AiProviderOptions | undefined;
  abstract classifyError(error: unknown): AiFailureKind;
}

/** 생성 체인이 업체 id로 찾는 어댑터 묶음. 시도 순서는 설정 AI_PROVIDER_ORDER가 정한다. */
export class AiProviderCatalog {
  readonly #adapters: ReadonlyMap<AiProviderId, AiProviderAdapter>;

  constructor(adapters: readonly AiProviderAdapter[]) {
    this.#adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  find(provider: AiProviderId): AiProviderAdapter | null {
    return this.#adapters.get(provider) ?? null;
  }

  list(): readonly AiProviderAdapter[] {
    return [...this.#adapters.values()];
  }
}
