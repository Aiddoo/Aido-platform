import { ENV } from '@src/shared/config/env';
import { TokenStore } from '@src/shared/storage/token-store';
import ky, { type AfterResponseHook, type BeforeRequestHook, type KyInstance } from 'ky';
import type {
  HttpClient,
  HttpClientConfig,
  HttpClientResponse,
  RequestConfig,
} from './http-client';

// 토큰 갱신 중복 방지
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// 토큰 갱신 함수
async function refreshAccessToken(baseUrl: string): Promise<string | null> {
  const refreshToken = await TokenStore.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await ky
      .post(`${baseUrl}/v1/auth/refresh`, {
        json: { refreshToken },
      })
      .json<{ accessToken: string; refreshToken: string }>();

    await TokenStore.setTokens(response.accessToken, response.refreshToken);
    return response.accessToken;
  } catch {
    await TokenStore.clearTokens();
    return null;
  }
}

// 토큰 주입 인터셉터
const createInjectToken = (): BeforeRequestHook => async (request) => {
  const accessToken = await TokenStore.getAccessToken();
  if (accessToken) {
    request.headers.set('Authorization', `Bearer ${accessToken}`);
  }
};

// 401 에러 처리 및 토큰 갱신 인터셉터
const createHandleUnauthorized =
  (baseUrl: string): AfterResponseHook =>
  async (request, options, response) => {
    if (response.status !== 401) return response;

    if (isRefreshing && refreshPromise) {
      const newToken = await refreshPromise;
      if (newToken) {
        request.headers.set('Authorization', `Bearer ${newToken}`);
        return ky(request, options);
      }
      return response;
    }

    isRefreshing = true;
    refreshPromise = refreshAccessToken(baseUrl);

    try {
      const newToken = await refreshPromise;
      if (newToken) {
        request.headers.set('Authorization', `Bearer ${newToken}`);
        return ky(request, options);
      }
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }

    return response;
  };

export class KyHttpClient implements HttpClient {
  private readonly client: KyInstance;

  constructor(config: HttpClientConfig = {}) {
    const baseUrl = config.baseUrl || ENV.API_URL;

    this.client = ky.create({
      prefixUrl: baseUrl,
      timeout: config.timeout || 30000,
      headers: config.headers,
      hooks: {
        beforeRequest: [createInjectToken()],
        afterResponse: [createHandleUnauthorized(baseUrl)],
      },
    });
  }

  async get<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>> {
    const response = await this.client.get(url, {
      searchParams: config?.params as Record<string, string | number | boolean>,
      headers: config?.headers,
      timeout: config?.timeout,
    });

    return {
      data: await response.json<T>(),
      status: response.status,
    };
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this.client.post(url, {
      json: data,
      headers: config?.headers,
      timeout: config?.timeout,
    });

    return {
      data: await response.json<T>(),
      status: response.status,
    };
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this.client.put(url, {
      json: data,
      headers: config?.headers,
      timeout: config?.timeout,
    });

    return {
      data: await response.json<T>(),
      status: response.status,
    };
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const response = await this.client.patch(url, {
      json: data,
      headers: config?.headers,
      timeout: config?.timeout,
    });

    return {
      data: await response.json<T>(),
      status: response.status,
    };
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>> {
    const response = await this.client.delete(url, {
      headers: config?.headers,
      timeout: config?.timeout,
    });

    return {
      data: await response.json<T>(),
      status: response.status,
    };
  }
}
