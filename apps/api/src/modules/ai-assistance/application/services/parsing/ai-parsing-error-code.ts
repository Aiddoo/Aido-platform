import { ErrorCode, type ErrorCodeType } from "@aido/api/errors";
import { match } from "ts-pattern";

import { providerFailure } from "../../observability/parsing/ai-generation-log.events.js";
import type { AiProviderErrorKind, AiUpstreamCause } from "../../ports/parsing/ai-provider.port.js";

/** 공급자 실패 종류를 사용자 파싱 응답 코드로 바꾼다. 일시 장애를 "이해 못함"으로 보내지 않는다. */
export function toParsingErrorCode(kind: AiProviderErrorKind): ErrorCodeType {
  return match(kind)
    .with("RATE_LIMITED", () => ErrorCode.AI_1310)
    .with("UNAVAILABLE", "UPSTREAM", "TIMEOUT", () => ErrorCode.AI_1301)
    .with("BLOCKED", "TRUNCATED", "INVALID_OUTPUT", () => ErrorCode.AI_1302)
    .exhaustive();
}

export interface ParsingFailure {
  readonly errorKind: AiProviderErrorKind;
  readonly statusCode: number | undefined;
  readonly upstream: AiUpstreamCause | undefined;
  readonly errorCode: ErrorCodeType;
}

/** 공급자 오류가 아닌 실패는 서버 정규화·검증이 거절한 출력으로 본다. */
export function describeParsingFailure(error: unknown): ParsingFailure {
  const failure = providerFailure(error);
  return { ...failure, errorCode: toParsingErrorCode(failure.errorKind) };
}
