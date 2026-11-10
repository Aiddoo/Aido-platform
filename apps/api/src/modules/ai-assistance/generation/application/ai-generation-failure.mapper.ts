import type { ErrorCodeType } from "@aido/api/errors";

import { resolveAiFailureRule } from "./ai-generation.errors.js";
import { type GenerationFailure, toGenerationFailure } from "./ai-generation.log-events.js";

export interface DescribedGenerationFailure extends GenerationFailure {
  readonly errorCode: ErrorCodeType;
}

/** 생성 실패 종류를 사용자 응답 코드로 바꾼다. 일시 장애를 "이해 못함"으로 보내지 않는다. */
export function describeGenerationFailure(error: unknown): DescribedGenerationFailure {
  const failure = toGenerationFailure(error);
  return { ...failure, errorCode: resolveAiFailureRule(failure.errorType).errorCode };
}
