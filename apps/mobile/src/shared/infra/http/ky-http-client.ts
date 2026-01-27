import type {
  HttpClient,
  HttpClientConfig,
  HttpClientResponse,
  RequestConfig,
} from '@src/core/ports/http';
import ky, { type KyInstance, type Options } from 'ky';

export class KyHttpClient implements HttpClient {
  private _client: KyInstance;

  constructor(configOrInstance?: HttpClientConfig | KyInstance) {
    if (configOrInstance && 'extend' in configOrInstance) {
      // KyInstance가 전달된 경우 - 이미 hooks가 설정되어 있으므로 그대로 사용
      this._client = configOrInstance;
    } else {
      // HttpClientConfig가 전달된 경우
      const config = configOrInstance as HttpClientConfig | undefined;
      const options: Options = {
        prefixUrl: config?.baseUrl,
        headers: config?.headers,
        timeout: config?.timeout,
      };
      this._client = ky.create(options);
    }
  }

  async get<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>> {
    const response = await this._client.get(url, this._buildOptions(config));
    return this._buildResponse<T>(response);
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this._client.post(url, {
      ...this._buildOptions(config),
      json: data,
    });
    return this._buildResponse<T>(response);
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this._client.put(url, {
      ...this._buildOptions(config),
      json: data,
    });
    return this._buildResponse<T>(response);
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this._client.patch(url, {
      ...this._buildOptions(config),
      json: data,
    });
    return this._buildResponse<T>(response);
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>> {
    const response = await this._client.delete(url, this._buildOptions(config));
    return this._buildResponse<T>(response);
  }

  private _buildOptions(config?: RequestConfig): Options {
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

  private async _buildResponse<T>(response: Response): Promise<HttpClientResponse<T>> {
    // 서버 응답: { success, data, timestamp } 에서 data 추출
    const json = (await response.json()) as { success: boolean; data: T; timestamp: number };
    return {
      data: json.data,
      status: response.status,
    };
  }
}
