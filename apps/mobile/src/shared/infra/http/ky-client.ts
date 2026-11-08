import { successEnvelopeSchema } from '@aido/api/common';
import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import { ParseError } from '@src/shared/errors/infra-error';
import { isNil, mapValues, omitBy } from 'es-toolkit';
import { HTTPError, type KyInstance, type Options } from 'ky';

import { readJsonBody, toApiError, toTransportError } from './ky-error';

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

  async get(url: string, config?: RequestConfig): Promise<Result<unknown, ApiError>> {
    return this.#request(() => this.#client.get(url, this.#buildOptions(config)));
  }

  async post(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<Result<unknown, ApiError>> {
    return this.#request(() =>
      this.#client.post(url, { ...this.#buildOptions(config), json: data }),
    );
  }

  async put(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<Result<unknown, ApiError>> {
    return this.#request(() =>
      this.#client.put(url, { ...this.#buildOptions(config), json: data }),
    );
  }

  async patch(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<Result<unknown, ApiError>> {
    return this.#request(() =>
      this.#client.patch(url, { ...this.#buildOptions(config), json: data }),
    );
  }

  async delete(url: string, config?: RequestConfig): Promise<Result<unknown, ApiError>> {
    const { body, ...restConfig } = config ?? {};
    return this.#request(() =>
      this.#client.delete(url, {
        ...this.#buildOptions(restConfig),
        // nullish-strict: null도 보낼 수 있는 JSON 본문이다
        ...(body !== undefined ? { json: body } : {}),
      }),
    );
  }

  async #request(request: () => Promise<Response>): Promise<Result<unknown, ApiError>> {
    try {
      const response = await request();
      const parsed = successEnvelopeSchema.safeParse(await readJsonBody(() => response.json()));
      if (!parsed.success) {
        throw new ParseError(`[KyHttpClient] Invalid success envelope: ${parsed.error.message}`);
      }
      return ok(parsed.data.data);
    } catch (error) {
      const transportError = toTransportError(error);
      if (transportError != null) {
        throw transportError;
      }

      if (error instanceof HTTPError) {
        return err(toApiError(error));
      }

      throw error;
    }
  }

  #buildOptions(config?: RequestConfig): Options {
    if (!config) {
      return {};
    }

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
      options.searchParams = mapValues(omitBy(config.params, isNil), String);
    }

    return options;
  }
}
