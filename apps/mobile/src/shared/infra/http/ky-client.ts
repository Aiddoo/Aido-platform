import type { HttpClient, RequestConfig } from '@src/core/ports/http';
import { ApiError } from '@src/shared/errors/api-error';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';
import { HTTPError, type KyInstance, TimeoutError as KyTimeoutError, type Options } from 'ky';
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
 * Ky 기반 Result HttpClient
 * - 4xx 에러: Result.err(ApiError) 반환
 * - 5xx/네트워크/타임아웃: throw InfraError → ErrorBoundary
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

        const body = await this.#parseErrorBody(response);
        const code = body?.error.code ?? `HTTP_${response.status}`;
        return err(
          new ApiError(
            code,
            resolveMessage(code, body?.error.message ?? response.statusText),
            response.status,
            body?.error.details,
          ),
        );
      }

      if (error instanceof TypeError) {
        throw new NetworkError();
      }

      throw error;
    }
  }

  async #parseErrorBody(response: Response): Promise<ServerErrorBody | null> {
    try {
      const body: unknown = await response.json();
      if (this.#isServerErrorBody(body)) {
        return body;
      }
      return null;
    } catch {
      return null;
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
