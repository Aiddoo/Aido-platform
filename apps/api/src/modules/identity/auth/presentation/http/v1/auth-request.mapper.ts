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

/**
 * OAuth 콜백 에러를 URLSearchParams로 변환
 * 에러 코드가 있는 예외(ApplicationException/DomainException)면 코드를 포함
 */
export function buildOAuthErrorParams(error: unknown, state: string): URLSearchParams {
  let errorCode = "authentication_failed";
  let errorMessage = "인증 처리 중 오류가 발생했습니다.";

  if (error instanceof ErrorCodedException) {
    errorCode = error.errorCode;
    errorMessage = error.message;
  }

  return new URLSearchParams({
    error: errorCode,
    error_description: errorMessage,
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
