import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

import {
  AiProviderError,
  type AiProviderErrorKind,
} from "../../../application/ports/parsing/ai-provider.port.js";

const SAFETY_BLOCK_PATTERN = /safety|input blocked|prohibited/i;
const ABORT_ERROR_NAMES = new Set(["TimeoutError", "AbortError"]);

/** AI SDK가 던진 오류를 원문 없이 공급자 오류 종류로 분류한다. */
export function classifyAiSdkError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  // 재시도가 바닥나면 SDK가 RetryError로 감싸므로 마지막 원인으로 분류한다.
  if (RetryError.isInstance(error)) {
    const last = classifyAiSdkError(error.lastError);
    return new AiProviderError(last.kind, last.statusCode, { cause: error });
  }
  if (APICallError.isInstance(error)) {
    return new AiProviderError(apiCallErrorKind(error), error.statusCode, { cause: error });
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return new AiProviderError(noObjectErrorKind(error), undefined, { cause: error });
  }
  if (error instanceof Error && ABORT_ERROR_NAMES.has(error.name)) {
    return new AiProviderError("TIMEOUT", undefined, { cause: error });
  }
  return new AiProviderError("UPSTREAM", undefined, { cause: error });
}

function apiCallErrorKind(error: APICallError): AiProviderErrorKind {
  if (error.statusCode === 429) return "RATE_LIMITED";
  if (error.statusCode === 400 && SAFETY_BLOCK_PATTERN.test(error.message)) return "BLOCKED";
  return "UPSTREAM";
}

function noObjectErrorKind(error: NoObjectGeneratedError): AiProviderErrorKind {
  if (error.finishReason === "length") return "TRUNCATED";
  if (error.finishReason === "content-filter") return "BLOCKED";
  return "INVALID_OUTPUT";
}
