import { ErrorCode, HttpStatus, isErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import {
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors/infra-error';
import { t, tDynamic } from '@src/shared/i18n';
import { HTTPError, isNetworkError, TimeoutError as KyTimeoutError } from 'ky';

import { errorEnvelopeSchema } from './error-envelope';
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

/** code가 알려진 ErrorCode면 로케일 문구를, 아니면 서버 메시지나 폴백을 쓴다 */
export function resolveMessage(code: string, serverMessage: string): string {
  if (isErrorCode(code)) {
    const mapped = tDynamic('errors', code);
    if (mapped) {
      return mapped;
    }
  }
  return serverMessage || t('errors:fallback');
}

export function toApiError(error: HTTPError): ApiError {
  const { response } = error;
  // ky v2는 에러 본문을 `error.data`로 미리 파싱하며 응답 스트림을 소비한다(`response.json()` 재호출 불가)
  const envelope = errorEnvelopeSchema.safeParse(error.data);
  const body = envelope.success ? envelope.data : undefined;
  const candidateCode = body?.error.code;
  const code = candidateCode && isErrorCode(candidateCode) ? candidateCode : ErrorCode.SYS_0001;

  return new ApiError(
    code,
    resolveMessage(code, body?.error.message ?? response.statusText),
    response.status,
    body?.error.details,
  );
}

/**
 * ky가 던진 실패 중 재시도 대상인 전송 실패(시간 초과, 5xx, 네트워크)를 앱 오류로 바꾼다.
 * 4xx와 그 밖의 오류는 호출자가 정하도록 null이다.
 */
export function toTransportError(error: unknown): TimeoutError | ServerError | NetworkError | null {
  if (error instanceof KyTimeoutError) {
    return new TimeoutError();
  }

  if (error instanceof HTTPError && error.response.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return new ServerError(error.response.status, {
      requestId: error.request.headers.get(REQUEST_ID_HEADER),
      request: { method: error.request.method, endpoint: getPathname(error.request.url) },
    });
  }

  // ky v2는 네트워크 실패를 자체 `NetworkError`로 감싸지만(`.cause`) raw TypeError도 방어적으로 처리한다
  if (isNetworkError(error) || error instanceof TypeError || isExpoFetchFailure(error)) {
    return new NetworkError();
  }

  return null;
}
