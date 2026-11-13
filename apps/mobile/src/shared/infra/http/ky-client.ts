import { successEnvelopeSchema } from '@aido/api/common';
import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import { ParseError } from '@src/shared/errors/infra-error';
import { isNil, mapValues, omitBy } from 'es-toolkit';
import { HTTPError, type KyInstance, type Options, type ResponsePromise } from 'ky';

import { readJsonBody, toApiError, toTransportError } from './ky-error';

/** HTTP 결과 → 도메인 에러 분류의 유일한 소유자다. afterResponse 훅은 관측만 하고 throw하지 않는다 */
export class KyHttpClient implements HttpClient {
  readonly #client: KyInstance;

  constructor(client: KyInstance) {
    this.#client = client;
  }

  get = async (url: string, config?: RequestConfig): Promise<Result<unknown, ApiError>> =>
    this.#request(() => this.#client.get(url, this.#buildOptions(config)));

  post = async (
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<Result<unknown, ApiError>> =>
    this.#request(() => this.#client.post(url, { ...this.#buildOptions(config), json: data }));

  put = async (
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<Result<unknown, ApiError>> =>
    this.#request(() => this.#client.put(url, { ...this.#buildOptions(config), json: data }));

  patch = async (
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<Result<unknown, ApiError>> =>
    this.#request(() => this.#client.patch(url, { ...this.#buildOptions(config), json: data }));

  delete = async (url: string, config?: RequestConfig): Promise<Result<unknown, ApiError>> => {
    const { body, ...restConfig } = config ?? {};
    return this.#request(() =>
      this.#client.delete(url, {
        ...this.#buildOptions(restConfig),
        // oxlint-disable-next-line aido/no-strict-nullish -- null도 보낼 수 있는 JSON 본문이다
        ...(body !== undefined ? { json: body } : {}),
      }),
    );
  };

  // ky의 `.json()` 단축 메서드만 요청 timeout을 본문 읽기에도 건다. 받은 Response의 `json()`은 헤더 뒤 본문이 멈추면 조회가 끝나지 않는다
  #request = async (request: () => ResponsePromise): Promise<Result<unknown, ApiError>> => {
    try {
      const parsed = successEnvelopeSchema.safeParse(await readJsonBody(() => request().json()));
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
  };

  #buildOptions = (config?: RequestConfig): Options => {
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
  };
}
