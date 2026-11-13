import type { RequestMetadata } from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import type { RequestSource } from "../decorators/request-source.decorator.js";
import { resolveRequestDevice } from "./request-device.mapper.js";

/**
 * 감사·관리자 알림용 메타데이터를 만든다. 구 앱은 기기 이름·타입을 본문으로 보내므로
 * 기기 정보는 본문 값이 RequestClient의 헤더 값보다 우선한다.
 */
export function toRequestMetadata(
  source: RequestSource,
  body?: { deviceName?: string; deviceType?: string },
): RequestMetadata {
  const { client } = source;

  return {
    ip: source.ip,
    userAgent: source.userAgent,
    device: resolveRequestDevice({
      client,
      userAgent: source.userAgent,
      acceptLanguage: source.acceptLanguage,
      deviceName: body?.deviceName,
      deviceType: body?.deviceType,
    }),
    ...(client.locale != null && { locale: client.locale }),
  };
}

// 코드 없는 실패에 앱 딥링크로 보내 온 값이다. 출시 앱이 받으므로 바꾸지 않는다
const OAUTH_UNCODED_FAILURE = {
  error: "authentication_failed",
  description: "인증 처리 중 오류가 발생했습니다.",
} as const;

/** OAuth 웹 콜백 실패를 앱 딥링크 query로 바꾼다. 코드가 있는 예외는 그 코드와 문구를 싣는다 */
export function buildOAuthErrorParams(error: unknown, state: string): URLSearchParams {
  if (error instanceof ErrorCodedException) {
    return new URLSearchParams({
      error: error.errorCode,
      error_description: error.message,
      state,
    });
  }
  return new URLSearchParams({
    error: OAUTH_UNCODED_FAILURE.error,
    error_description: OAUTH_UNCODED_FAILURE.description,
    state,
  });
}

// passport-jwt fromAuthHeaderAsBearerToken과 같은 규칙: 앞 두 덩어리 중 scheme이 bearer(대소문자 무시)일 때만 토큰이다
export function readBearerToken(authorization: string | undefined): string | null {
  const matches = authorization?.match(/(\S+)\s+(\S+)/);
  if (matches == null) {
    return null;
  }
  const [, scheme, token] = matches;
  return scheme?.toLowerCase() === "bearer" && token != null ? token : null;
}
