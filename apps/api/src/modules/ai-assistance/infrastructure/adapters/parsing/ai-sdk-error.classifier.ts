import { APICallError, NoObjectGeneratedError, RetryError } from "ai";

import {
  AiProviderError,
  type AiProviderErrorKind,
  type AiUpstreamCause,
} from "../../../application/ports/parsing/ai-provider.port.js";

const SAFETY_BLOCK_PATTERN = /safety|input blocked|prohibited/i;
const ABORT_ERROR_NAMES = new Set(["TimeoutError", "AbortError"]);
/** 공급자 상태·오류 코드로 남기는 값은 고정 기호뿐이다(원문 문장이 섞이지 않게 모양을 제한한다). */
const SYMBOL_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/** AI SDK가 던진 오류를 원문 없이 공급자 오류 종류로 분류한다. */
export function classifyAiSdkError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  // 재시도가 바닥나면 SDK가 RetryError로 감싸므로 마지막 원인으로 분류한다.
  if (RetryError.isInstance(error)) {
    const last = classifyAiSdkError(error.lastError);
    return new AiProviderError(last.kind, last.statusCode, {
      cause: error,
      upstream: last.upstream,
    });
  }
  const upstream = describeUpstreamCause(error);
  if (APICallError.isInstance(error)) {
    return new AiProviderError(apiCallErrorKind(error), error.statusCode, {
      cause: error,
      upstream,
    });
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return new AiProviderError(noObjectErrorKind(error), undefined, { cause: error, upstream });
  }
  if (error instanceof Error && ABORT_ERROR_NAMES.has(error.name)) {
    return new AiProviderError("TIMEOUT", undefined, { cause: error, upstream });
  }
  return new AiProviderError("UPSTREAM", undefined, { cause: error, upstream });
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

/** 오류 이름, 공급자 응답의 error.status, 네트워크 오류 code만 뽑는다. */
function describeUpstreamCause(error: unknown): AiUpstreamCause {
  const errorName = error instanceof Error ? error.name : typeof error;
  const providerStatus = APICallError.isInstance(error)
    ? readProviderStatus(error.responseBody)
    : undefined;
  const errorCode = readErrorCode(error);
  return {
    errorName,
    ...(providerStatus != null && { providerStatus }),
    ...(errorCode != null && { errorCode }),
  };
}

/** Google 오류 본문 `{ error: { status: "UNAVAILABLE" } }`의 상태 기호 */
function readProviderStatus(responseBody: string | undefined): string | undefined {
  if (responseBody == null) return undefined;
  try {
    const status: unknown = Reflect.get(
      Object(Reflect.get(Object(JSON.parse(responseBody)), "error")),
      "status",
    );
    return typeof status === "string" && SYMBOL_PATTERN.test(status) ? status : undefined;
  } catch {
    return undefined;
  }
}

/** cause를 따라가며 찾은 Node·undici 네트워크 오류 code(예: ECONNRESET, UND_ERR_CONNECT_TIMEOUT) */
function readErrorCode(error: unknown, depth = 0): string | undefined {
  if (error == null || depth > 3) return undefined;
  const code: unknown = Reflect.get(Object(error), "code");
  if (typeof code === "string" && SYMBOL_PATTERN.test(code)) return code;
  return readErrorCode(Reflect.get(Object(error), "cause"), depth + 1);
}
