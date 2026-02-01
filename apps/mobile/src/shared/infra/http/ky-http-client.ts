import type {
  HttpClient,
  HttpClientConfig,
  HttpClientResponse,
  RequestConfig,
} from '@src/core/ports/http';
import ky, { type KyInstance, type Options } from 'ky';

export class KyHttpClient implements HttpClient {
  readonly #client: KyInstance;

  constructor(configOrInstance?: HttpClientConfig | KyInstance) {
    if (configOrInstance && 'extend' in configOrInstance) {
      // KyInstance가 전달된 경우 - 이미 hooks가 설정되어 있으므로 그대로 사용
      this.#client = configOrInstance;
    } else {
      // HttpClientConfig가 전달된 경우
      const config = configOrInstance as HttpClientConfig | undefined;
      const options: Options = {
        prefixUrl: config?.baseUrl,
        headers: config?.headers,
        timeout: config?.timeout,
      };
      this.#client = ky.create(options);
    }
  }

  async get<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>> {
    const response = await this.#client.get(url, this.#buildOptions(config));
    return this.#buildResponse<T>(response);
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this.#client.post(url, {
      ...this.#buildOptions(config),
      json: data,
    });
    return this.#buildResponse<T>(response);
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this.#client.put(url, {
      ...this.#buildOptions(config),
      json: data,
    });
    return this.#buildResponse<T>(response);
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this.#client.patch(url, {
      ...this.#buildOptions(config),
      json: data,
    });
    return this.#buildResponse<T>(response);
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>> {
    const response = await this.#client.delete(url, this.#buildOptions(config));
    return this.#buildResponse<T>(response);
  }

  #buildOptions(config?: RequestConfig): Options {
    const options: Options = {};

    if (config?.headers) {
      options.headers = config.headers;
    }

    if (config?.timeout) {
      options.timeout = config.timeout;
    }

    if (config?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(config.params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      options.searchParams = searchParams;
    }

    return options;
  }

  async #buildResponse<T>(response: Response): Promise<HttpClientResponse<T>> {
    // 서버 응답: { success, data, timestamp } 에서 data 추출
    const json = (await response.json()) as { success: boolean; data: T; timestamp: number };
    return {
      data: json.data,
      status: response.status,
    };
  }
}
