import type { ErrorCodeType } from "@aido/api/errors";

import {
  type GenerationFailure,
  generationFailure,
} from "../../observability/generation/ai-generation-log.events.js";
import { resolveAiFailureRule } from "../../ports/generation/ai-generation.errors.js";

export interface ParsingFailure extends GenerationFailure {
  readonly errorCode: ErrorCodeType;
}

/** 생성 실패 종류를 사용자 응답 코드로 바꾼다. 일시 장애를 "이해 못함"으로 보내지 않는다. */
export function describeParsingFailure(error: unknown): ParsingFailure {
  const failure = generationFailure(error);
  return { ...failure, errorCode: resolveAiFailureRule(failure.errorType).errorCode };
}
