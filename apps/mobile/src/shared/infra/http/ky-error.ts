import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { findErrorCodeMessage } from '@src/shared/errors/error-code-message';
import {
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors/infra-error';
import { t } from '@src/shared/i18n';
import { HTTPError, isNetworkError, TimeoutError as KyTimeoutError } from 'ky';

import { readErrorEnvelope, toKnownErrorCode } from './error-envelope';
import { REQUEST_ID_HEADER } from './request-headers';
import { getPathname } from './request-path';

/** RN 전역 fetch(expo/fetch)는 연결 실패를 `fetch failed: …` 일반 Error로 던지고 클래스를 내보내지 않아 ky도 알아보지 못한다 */
const EXPO_FETCH_FAILURE_PREFIX = 'fetch failed: ';

function isExpoFetchFailure(error: unknown) {
  return error instanceof Error && error.message.startsWith(EXPO_FETCH_FAILURE_PREFIX);
}

/** 본문 파서가 다른 실행 환경에서 던진 SyntaxError도 `instanceof` 없이 알아본다 */
function isSyntaxError(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error != null &&
    'name' in error &&
    error.name === 'SyntaxError' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

/** 접속 인증 Wi-Fi의 HTML처럼 JSON이 아닌 본문은 봉투 검증 실패와 같은 `ParseError`로 바꾼다 */
export async function readJsonBody(read: () => Promise<unknown>): Promise<unknown> {
  try {
    return await read();
  } catch (error) {
    if (isSyntaxError(error)) {
      throw new ParseError(`Response body is not valid JSON: ${error.message}`);
    }

    throw error;
  }
}

/** 알려진 코드는 카탈로그 문구를, 앱이 모르는 코드는 서버가 요청 언어로 준 message를, 둘 다 없으면 폴백을 쓴다 */
export function resolveMessage(code: string | null, serverMessage: string | null): string {
  const catalogMessage = code == null ? null : findErrorCodeMessage(code);
  return catalogMessage ?? (serverMessage || t('errors:fallback'));
}

export function toApiError(error: HTTPError): ApiError {
  // ky v2는 에러 본문을 `error.data`로 미리 파싱하며 응답 스트림을 소비한다(`response.json()` 재호출 불가)
  const envelope = readErrorEnvelope(error.data);
  // 분기는 아는 코드로만 하고(모르면 SYS_0001), 문구는 서버가 보낸 코드 그대로 고른다
  return new ApiError(
    toKnownErrorCode(envelope?.code) ?? ErrorCode.SYS_0001,
    resolveMessage(envelope?.code ?? null, envelope?.message ?? null),
    error.response.status,
    envelope?.details ?? null,
    { requestId: error.request.headers.get(REQUEST_ID_HEADER) ?? undefined },
  );
}

function toServerError(error: HTTPError): ServerError {
  const envelope = readErrorEnvelope(error.data);
  return new ServerError(error.response.status, {
    serverCode: toKnownErrorCode(envelope?.code),
    details: envelope?.details ?? null,
    requestId: error.request.headers.get(REQUEST_ID_HEADER),
    request: { method: error.request.method, endpoint: getPathname(error.request.url) },
  });
}

/**
 * ky가 던진 실패 중 재시도 대상인 전송 실패(시간 초과, 5xx, 네트워크)를 앱 오류로 바꾼다.
 * 4xx와 그 밖의 오류(요청 경로의 코드 버그인 TypeError 포함)는 호출자가 정하도록 null이다.
 */
export function toTransportError(error: unknown): TimeoutError | ServerError | NetworkError | null {
  if (error instanceof KyTimeoutError) {
    return new TimeoutError();
  }

  if (error instanceof HTTPError && error.response.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return toServerError(error);
  }

  // RN fetch의 `TypeError: Network request failed`는 ky가 자체 NetworkError로 감싼다. 맨 TypeError는 코드 버그라 연결 오류로 뭉개지 않는다
  if (isNetworkError(error) || isExpoFetchFailure(error)) {
    return new NetworkError();
  }

  return null;
}
