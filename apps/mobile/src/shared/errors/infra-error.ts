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

/** 네트워크 연결 에러 */
export class NetworkError extends InfraError {
  readonly statusCode = null;

  constructor() {
    super('네트워크 연결을 확인해주세요');
  }
}

/** 요청 타임아웃 */
export class TimeoutError extends InfraError {
  readonly statusCode = 504;

  constructor() {
    super('요청 시간이 초과되었어요');
  }
}

/** 5xx 서버 에러 */
export class ServerError extends InfraError {
  readonly statusCode: number;

  constructor(status: number) {
    super('서버에 문제가 발생했어요');
    this.statusCode = status;
  }
}

/** 응답 파싱/검증 에러 */
export class ParseError extends InfraError {
  readonly statusCode = null;

  constructor(message = '응답 형식이 올바르지 않아요') {
    super(message);
  }
}

/** InfraError 타입 가드 */
export const isInfraError = (error: unknown): error is InfraError => error instanceof InfraError;
