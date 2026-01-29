/**
 * 클라이언트 에러 인터페이스
 * - 모든 도메인 에러가 구현해야 하는 계약
 */
export interface IClientError {
  readonly name: string;
  readonly code: string; // UPPER_SNAKE_CASE (예: INVALID_TAG)
  readonly message: string;
}

/**
 * 클라이언트 에러 기본 클래스
 * - 앱 내부에서 발생하는 에러 (서버 에러와 구분)
 * - 각 도메인별 에러 클래스가 상속하여 사용
 */
export abstract class ClientError extends Error implements IClientError {
  override readonly name: string = 'ClientError';
  abstract readonly code: string;
}

/** ClientError 타입 가드 */
export const isClientError = (error: unknown): error is ClientError => error instanceof ClientError;
