import type { Request } from "express";

import type { RequestMetadata } from "#api/modules/identity/application/types/auth/auth.types";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";

import { resolveRequestDevice } from "./request-device.utils.js";

/**
 * 요청에서 메타데이터 추출
 */
export function extractMetadata(
  req: Request,
  body?: { deviceName?: string; deviceType?: string },
): RequestMetadata {
  const userAgent = req.headers["user-agent"];
  const deviceName = body?.deviceName ?? singleHeaderValue(req.headers["x-device-name"]);
  const deviceType = body?.deviceType ?? singleHeaderValue(req.headers["x-device-type"]);

  return {
    ip: req.ip || undefined,
    userAgent,
    deviceName,
    deviceType,
    device: resolveRequestDevice({
      userAgent,
      deviceName,
      deviceType,
      osVersion: req.headers["x-os-version"],
      appVersion: req.headers["x-app-version"],
      appBuild: req.headers["x-app-build"],
      acceptLanguage: req.headers["accept-language"],
      timezone: req.headers["x-timezone"],
    }),
  };
}

function singleHeaderValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
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
