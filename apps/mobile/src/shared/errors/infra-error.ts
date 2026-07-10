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

/** 네트워크 연결 에러 */
export class NetworkError extends InfraError {
  readonly statusCode = null;

  constructor() {
    super(t('common:infraErrors.network'));
  }
}

/** 요청 타임아웃 */
export class TimeoutError extends InfraError {
  readonly statusCode = 504;

  constructor() {
    super(t('common:infraErrors.timeout'));
  }
}

/** 5xx 서버 에러 */
export class ServerError extends InfraError {
  readonly statusCode: number;

  constructor(status: number) {
    super(t('common:infraErrors.server'));
    this.statusCode = status;
  }
}

/**
 * 토큰 갱신 중 일시 장애(서버 재시작·네트워크·타임아웃·5xx·잠긴 키체인).
 *
 * **세션은 여전히 유효하다** — 서버가 아직 살아나지 못했을 뿐이다. 401이 아니라 재시도
 * 가능한 InfraError로 표면화해, React Query가 5xx/네트워크와 동일하게 자동 재시도하게 한다
 * (콜드 스타트/서버 재시작 구간에 재시도 화면 대신 로딩을 유지하고 스스로 회복).
 */
export class TransientAuthError extends InfraError {
  readonly statusCode = 503;

  constructor() {
    super(t('common:infraErrors.server'));
  }
}

/** 응답 파싱/검증 에러 */
export class ParseError extends InfraError {
  readonly statusCode = null;

  constructor(message = t('common:infraErrors.invalidResponse')) {
    super(message);
  }
}

/** InfraError 타입 가드 */
export const isInfraError = (error: unknown): error is InfraError => error instanceof InfraError;

/** TransientAuthError 타입 가드 */
export const isTransientAuthError = (error: unknown): error is TransientAuthError =>
  error instanceof TransientAuthError;
