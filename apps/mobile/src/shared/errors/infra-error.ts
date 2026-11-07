import { t } from '@src/shared/i18n';

/**
 * 인프라 에러 - ErrorBoundary에서 처리
 * - 5xx 서버 에러
 * - 네트워크 에러
 * - 타임아웃
 * - 응답 파싱 실패
 *
 * UI에서 개별 처리하지 않고 ErrorBoundary로 전파됨
 */
export abstract class InfraError extends Error {
  override readonly name = 'InfraError';
  abstract readonly statusCode: number | null;
}

export class NetworkError extends InfraError {
  readonly statusCode = null;

  constructor() {
    super(t('common:infraErrors.network'));
  }
}

export class TimeoutError extends InfraError {
  readonly statusCode = 504;

  constructor() {
    super(t('common:infraErrors.timeout'));
  }
}

export class ServerError extends InfraError {
  readonly statusCode: number;
  /** 같은 요청의 서버 로그·Sentry 이벤트를 찾는 `X-Request-Id` */
  readonly requestId: string | null;

  constructor(status: number, requestId: string | null = null) {
    super(t('common:infraErrors.server'));
    this.statusCode = status;
    this.requestId = requestId;
  }
}

export class ParseError extends InfraError {
  readonly statusCode = null;

  constructor(message = t('common:infraErrors.invalidResponse')) {
    super(message);
  }
}

export function isInfraError(error: unknown): error is InfraError {
  return error instanceof InfraError;
}

/** 연결이 끊겼거나 응답이 오지 않은 오류. 기기 상태라 예외 리포트 대신 경고로 남긴다 */
export function isConnectivityError(error: unknown): error is NetworkError | TimeoutError {
  return error instanceof NetworkError || error instanceof TimeoutError;
}
