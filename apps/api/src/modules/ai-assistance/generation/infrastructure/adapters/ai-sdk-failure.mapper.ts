import {
  APICallError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  RetryError,
  TypeValidationError,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";

import {
  type AiFailureKind,
  type AiUpstreamCause,
  resolveAiFailureRule,
} from "../../application/ai-generation.errors.js";
import type { AiLanguageModel } from "./ai-provider.adapter.js";

const ABORT_ERROR_NAMES = new Set(["TimeoutError", "AbortError"]);
/** 공급자 상태·오류 코드로 남기는 값은 고정 기호뿐이다(원문 문장이 섞이지 않게 모양을 제한한다). */
const SYMBOL_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * 세 업체 오류 본문의 공통 모양. Anthropic `{ error: { type } }`, OpenAI `{ error: { type, code } }`,
 * Google `{ error: { status, details[].reason } }`. 분류에만 쓰고 로그에는 기호만 남긴다.
 */
const providerErrorBodySchema = z.object({
  error: z.object({
    type: z.string().optional(),
    code: z.union([z.string(), z.number()]).optional(),
    status: z.string().optional(),
    message: z.string().optional(),
    details: z.array(z.object({ reason: z.string().optional() })).optional(),
  }),
});

export type ProviderErrorBody = z.infer<typeof providerErrorBodySchema>["error"];

function readProviderErrorBody(responseBody: string | undefined): ProviderErrorBody {
  if (responseBody == null) {
    return {};
  }
  try {
    const parsed = providerErrorBodySchema.safeParse(JSON.parse(responseBody));
    return parsed.success ? parsed.data.error : {};
  } catch {
    return {};
  }
}

export type ApiCallErrorClassifier = (
  statusCode: number | undefined,
  body: ProviderErrorBody,
  responseBody: string | undefined,
) => AiFailureKind;

/**
 * AI SDK 공통 오류(재시도 소진·출력 검증·중단·네트워크)를 분류하고, HTTP 오류만 업체 해석에 맡긴다.
 */
export function classifyAiSdkError(
  error: unknown,
  classifyApiCall: ApiCallErrorClassifier,
): AiFailureKind {
  // 재시도가 바닥나면 SDK가 RetryError로 감싸므로 마지막 원인으로 분류한다.
  if (RetryError.isInstance(error)) {
    return classifyAiSdkError(error.lastError, classifyApiCall);
  }
  if (APICallError.isInstance(error)) {
    return classifyApiCall(
      error.statusCode,
      readProviderErrorBody(error.responseBody),
      error.responseBody,
    );
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    if (error.finishReason === "length") {
      return "TRUNCATED";
    }
    if (error.finishReason === "content-filter") {
      return "BLOCKED";
    }
    return "INVALID_OUTPUT";
  }
  if (NoOutputGeneratedError.isInstance(error) || TypeValidationError.isInstance(error)) {
    return "INVALID_OUTPUT";
  }
  if (error instanceof Error && ABORT_ERROR_NAMES.has(error.name)) {
    return "TIMEOUT";
  }
  return "UPSTREAM";
}

/**
 * 결제·인증 실패는 다시 불러도 같으므로 SDK 재시도에서 뺀다. SDK는 HTTP 상태만 보고 소진 429도
 * 재시도 대상으로 표시하므로 분류 결과로 그 표시를 끈다.
 */
export function withoutRetryOnBillingFailure(
  model: AiLanguageModel,
  classify: (error: unknown) => AiFailureKind,
): AiLanguageModel {
  return wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: async ({ doGenerate }) => {
        try {
          return await doGenerate();
        } catch (error) {
          if (
            APICallError.isInstance(error) &&
            error.isRetryable &&
            resolveAiFailureRule(classify(error)).breaker === "billing"
          ) {
            throw new APICallError({
              message: error.message,
              url: error.url,
              requestBodyValues: error.requestBodyValues,
              statusCode: error.statusCode,
              responseHeaders: error.responseHeaders,
              responseBody: error.responseBody,
              cause: error.cause,
              data: error.data,
              isRetryable: false,
            });
          }
          throw error;
        }
      },
    },
  });
}

/** 실패한 시도가 쓴 토큰. 출력 검증 실패도 요금이 나가므로 비용에 더한다. */
export function readFailedUsage(error: unknown) {
  return NoObjectGeneratedError.isInstance(error) ? error.usage : undefined;
}

/** 오류 이름, HTTP 상태, 공급자 오류 기호, 네트워크 오류 code만 뽑는다. */
export function describeUpstreamCause(error: unknown): AiUpstreamCause {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  const errorType = cause instanceof Error ? cause.name : typeof cause;
  const networkCode = readNetworkCode(cause);
  const network = networkCode == null ? {} : { networkCode };
  if (APICallError.isInstance(cause)) {
    const body = readProviderErrorBody(cause.responseBody);
    const providerStatus = [body.status, body.type, body.code].find(
      (value) => typeof value === "string" && SYMBOL_PATTERN.test(value),
    );
    return {
      errorType,
      ...(cause.statusCode != null && { statusCode: cause.statusCode }),
      ...(typeof providerStatus === "string" && { providerStatus }),
      ...network,
    };
  }
  return { errorType, ...network };
}

/** cause를 따라가며 찾은 Node·undici 네트워크 오류 code(예: ECONNRESET, UND_ERR_CONNECT_TIMEOUT) */
function readNetworkCode(error: unknown, depth = 0): string | undefined {
  if (error == null || depth > 3) {
    return undefined;
  }
  const code: unknown = Reflect.get(Object(error), "code");
  if (typeof code === "string" && SYMBOL_PATTERN.test(code)) {
    return code;
  }
  return readNetworkCode(Reflect.get(Object(error), "cause"), depth + 1);
}
