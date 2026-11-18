import type { AiGenerationMeta } from "../../ai-generations/domain/ai-generation.aggregate.js";
import type { ParseMetaReadModel } from "./read-models/parsed-draft.read-model.js";

/** 생성 메타를 공개 응답의 모델·처리 시간·토큰·프롬프트 버전으로 줄인다 */
export function toParseMeta(
  meta: AiGenerationMeta,
  parse: { readonly promptVersion: string; readonly processingTimeMs: number },
): ParseMetaReadModel {
  return {
    model: meta.model,
    processingTimeMs: parse.processingTimeMs,
    tokenUsage: { input: meta.inputTokens, output: meta.outputTokens },
    promptVersion: parse.promptVersion,
  };
}
