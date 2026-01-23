export interface HttpClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface HttpClientResponse<T> {
  data: T;
  status: number;
}

export interface HttpClient {
  get<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>>;
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpClientResponse<T>>;
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpClientResponse<T>>;
  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpClientResponse<T>>;
  delete<T>(url: string, config?: RequestConfig): Promise<HttpClientResponse<T>>;
}
