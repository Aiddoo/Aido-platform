import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";
import type { Logger } from "@nestjs/common";

import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { AuthLogEvent } from "../../application/auth.log-events.js";

const PROVIDER_ERROR_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

/** OAuth 오류 본문(`{ error, error_code }`)에서 공급자의 짧은 오류 기호만 읽는다. 설명·원문은 버린다. */
export async function readOAuthProviderError(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    return [Reflect.get(Object(body), "error_code"), Reflect.get(Object(body), "error")]
      .filter((value) => typeof value === "string")
      .find((value) => PROVIDER_ERROR_PATTERN.test(value));
  } catch {
    return undefined;
  }
}

// 공급자 오류 원문에는 토큰 payload가 섞일 수 있어 오류 종류·코드만 남긴다
export function logOAuthTokenVerifyFailed(
  logger: Pick<Logger, "error">,
  provider: (typeof OAUTH_PROVIDERS)[number],
  error: unknown,
  reason?: "expired" | "invalid",
): void {
  logger.error({
    event: AuthLogEvent.OAUTH_TOKEN_VERIFY_FAILED,
    provider,
    ...(reason != null && { reason }),
    errorType: toErrorType(error),
    ...(error instanceof ErrorCodedException && { errorCode: error.errorCode }),
  });
}
