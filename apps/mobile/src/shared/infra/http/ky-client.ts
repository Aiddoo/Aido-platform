import { ErrorCode } from '@aido/errors';
import type { HttpClient, RequestConfig } from '@src/core/ports/http';
import { ApiError } from '@src/shared/errors/api-error';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';
import {
  HTTPError,
  isNetworkError,
  type KyInstance,
  TimeoutError as KyTimeoutError,
  type Options,
} from 'ky';

import { resolveMessage } from './error-handler';

interface ServerResponse<T> {
  success: boolean;
  data: T;
  timestamp: number;
}

interface ServerErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Ky 기반 Result HttpClient — HTTP 결과 → 도메인 에러 분류의 **유일한 소유자**.
 * - 4xx 에러: Result.err(ApiError) 반환
 * - 5xx: throw ServerError (React Query가 자동 재시도)
 * - 네트워크/타임아웃: throw NetworkError/TimeoutError (동일하게 재시도)
 *
 * afterResponse 훅(error-handler)은 관측(breadcrumb)만 하고 절대 throw하지 않는다.
 */
export class KyHttpClient implements HttpClient {
  readonly #client: KyInstance;

  constructor(client: KyInstance) {
    this.#client = client;
  }

  async get<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>> {
    return this.#request<T>(() => this.#client.get(url, this.#buildOptions(config)));
  }

  async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>> {
    return this.#request<T>(() =>
      this.#client.post(url, { ...this.#buildOptions(config), json: data }),
    );
  }

  async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<T, ApiError>> {
    return this.#request<T>(() =>
      this.#client.put(url, { ...this.#buildOptions(config), json: data }),
    );
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<Result<T, ApiError>> {
    return this.#request<T>(() =>
      this.#client.patch(url, { ...this.#buildOptions(config), json: data }),
    );
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<Result<T, ApiError>> {
    const { body, ...restConfig } = config ?? {};
    return this.#request<T>(() =>
      this.#client.delete(url, {
        ...this.#buildOptions(restConfig),
        ...(body !== undefined ? { json: body } : {}),
      }),
    );
  }

  async #request<T>(request: () => Promise<Response>): Promise<Result<T, ApiError>> {
    try {
      const response = await request();
      const { data } = (await response.json()) as ServerResponse<T>;
      return ok(data);
    } catch (error) {
      if (error instanceof KyTimeoutError) {
        throw new TimeoutError();
      }

      if (error instanceof HTTPError) {
        const { response } = error;

        if (response.status >= 500) {
          throw new ServerError(response.status);
        }

        // ky v2는 에러 본문을 `error.data`로 미리 파싱하며 응답 스트림을 소비한다
        // (`response.json()` 재호출 불가). 미리 파싱된 값에서 서버 에러 코드를 읽는다.
        const parsed: unknown = error.data;
        const body = this.#isServerErrorBody(parsed) ? parsed : null;
        const code = body?.error.code ?? ErrorCode.SYS_0001;
        return err(
          new ApiError(
            code,
            resolveMessage(code, body?.error.message ?? response.statusText),
            response.status,
            body?.error.details,
          ),
        );
      }

      // ky v2는 네트워크 실패를 자체 `NetworkError`로 감싼다(원인은 `.cause`).
      // 방어적으로 raw TypeError도 함께 처리한다.
      if (isNetworkError(error) || error instanceof TypeError) {
        throw new NetworkError();
      }

      throw error;
    }
  }

  #isServerErrorBody(body: unknown): body is ServerErrorBody {
    return (
      body !== null &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as ServerErrorBody).error === 'object' &&
      (body as ServerErrorBody).error !== null
    );
  }

  #buildOptions(config?: RequestConfig): Options {
    if (!config) return {};

    const options: Options = {};

    if (config.headers) {
      options.headers = config.headers;
    }

    if (config.timeout) {
      options.timeout = config.timeout;
    }

    if (config.signal) {
      options.signal = config.signal;
    }

    if (config.params) {
      options.searchParams = Object.fromEntries(
        Object.entries(config.params)
          .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
          .map(([key, value]) => [key, String(value)]),
      );
    }

    return options;
  }
}
