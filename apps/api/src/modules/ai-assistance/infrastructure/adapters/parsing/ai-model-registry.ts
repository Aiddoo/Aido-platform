import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createProviderRegistry, NoSuchModelError } from "ai";

import type { AiModelId } from "../../config/parsing/ai-task-config.js";

type RegisteredProviders = Parameters<typeof createProviderRegistry>[0];

/**
 * API 키가 있는 공급자만 AI SDK provider registry에 등록한다. 공급자를 늘릴 때는 패키지를 설치하고
 * 여기에 키와 함께 등록한 뒤 AI_MODEL_<TASK>를 `<provider>:<model>`로 바꾼다.
 */
export function createAiModelRegistry(apiKeys: { readonly google: string | undefined }) {
  const providers: RegisteredProviders = {};
  const googleApiKey = apiKeys.google;
  if (googleApiKey != null && googleApiKey !== "") {
    providers.google = createGoogleGenerativeAI({ apiKey: googleApiKey });
  }
  return createProviderRegistry(providers);
}

type AiModelRegistry = ReturnType<typeof createAiModelRegistry>;

export interface ResolvedAiModel {
  readonly id: AiModelId;
  readonly model: ReturnType<AiModelRegistry["languageModel"]>;
}

/** 등록되지 않은 공급자(키 없음·미설치)의 모델은 null이다. */
export function resolveAiModel(registry: AiModelRegistry, id: AiModelId): ResolvedAiModel | null {
  try {
    return { id, model: registry.languageModel(id) };
  } catch (error) {
    if (NoSuchModelError.isInstance(error)) {
      return null;
    }
    throw error;
  }
}
