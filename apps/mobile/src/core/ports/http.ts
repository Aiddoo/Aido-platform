import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

export interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
  /** React Query 같은 호출자가 취소 소유권을 transport까지 전달한다. */
  signal?: AbortSignal;
  body?: unknown;
}

/**
 * Result 기반 HttpClient
 * - 4xx 에러: Result.err(ApiError) 반환
 * - 5xx/네트워크/타임아웃: throw InfraError → ErrorBoundary 처리
 */
export interface HttpClient {
  get(url: string, config?: RequestConfig): Promise<Result<unknown, ApiError>>;
  post(url: string, data?: unknown, config?: RequestConfig): Promise<Result<unknown, ApiError>>;
  put(url: string, data?: unknown, config?: RequestConfig): Promise<Result<unknown, ApiError>>;
  patch(url: string, data?: unknown, config?: RequestConfig): Promise<Result<unknown, ApiError>>;
  delete(url: string, config?: RequestConfig): Promise<Result<unknown, ApiError>>;
}
