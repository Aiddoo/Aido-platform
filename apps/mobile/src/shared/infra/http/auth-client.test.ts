import { createMockStorage } from '@src/shared/__tests__';

jest.mock('@src/shared/config/env', () => ({
  ENV: {
    APP_ENV: 'development',
    IS_DEV: true,
    IS_PRODUCTION: false,
    API_URL: 'http://localhost:3000',
    SCHEME: 'aido',
    PLATFORM: 'ios',
    IS_IOS: true,
    IS_ANDROID: false,
  },
}));

import { createTokenRefreshHook } from './auth-client';

const RETRY_MARKER_HEADER = 'x-retried-after-refresh';

const createFakeRequest = (headers: Record<string, string> = {}): Request => {
  const headerMap = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
      has: (name: string) => headerMap.has(name.toLowerCase()),
      set: (name: string, value: string) => {
        headerMap.set(name.toLowerCase(), value);
      },
    },
  } as unknown as Request;
};

const createFakeResponse = (status: number): Response => ({ status }) as unknown as Response;

describe('createTokenRefreshHook', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let refresh: jest.Mock;
  let retry: jest.Mock;
  let hook: ReturnType<typeof createTokenRefreshHook>;

  beforeEach(() => {
    storage = createMockStorage();
    refresh = jest.fn();
    retry = jest.fn();
    hook = createTokenRefreshHook({ storage, refresh, retry });
  });

  const invokeHook = (request: Request, response: Response) =>
    (hook as (req: Request, opts: unknown, res: Response) => Promise<Response>)(
      request,
      {},
      response,
    );

  it('401이 아니면 응답을 그대로 통과시켜야 한다', async () => {
    // Given
    const response = createFakeResponse(200);

    // When
    const result = await invokeHook(createFakeRequest(), response);

    // Then
    expect(result).toBe(response);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('재시도 마커가 있으면 갱신 없이 응답을 반환해야 한다 (루프 가드)', async () => {
    // Given
    const response = createFakeResponse(401);
    const request = createFakeRequest({ [RETRY_MARKER_HEADER]: '1' });

    // When
    const result = await invokeHook(request, response);

    // Then
    expect(result).toBe(response);
    expect(refresh).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it('보낸 토큰이 저장된 토큰과 다르면(이미 로테이션됨) 갱신 없이 재시도해야 한다', async () => {
    // Given
    storage.get.mockResolvedValue('fresh-token');
    const request = createFakeRequest({ Authorization: 'Bearer stale-token' });
    const retried = createFakeResponse(200);
    retry.mockResolvedValue(retried);

    // When
    const result = await invokeHook(request, createFakeResponse(401));

    // Then
    expect(refresh).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(request.headers.get(RETRY_MARKER_HEADER)).toBe('1');
    expect(result).toBe(retried);
  });

  it('갱신 성공 시 마커를 달아 재시도해야 한다', async () => {
    // Given
    storage.get.mockResolvedValue('current-token');
    refresh.mockResolvedValue(true);
    const request = createFakeRequest({ Authorization: 'Bearer current-token' });
    const retried = createFakeResponse(200);
    retry.mockResolvedValue(retried);

    // When
    const result = await invokeHook(request, createFakeResponse(401));

    // Then
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(request.headers.get(RETRY_MARKER_HEADER)).toBe('1');
    expect(result).toBe(retried);
  });

  it('갱신 실패 시 원래 401 응답을 반환해야 한다', async () => {
    // Given
    storage.get.mockResolvedValue('current-token');
    refresh.mockResolvedValue(false);
    const request = createFakeRequest({ Authorization: 'Bearer current-token' });
    const response = createFakeResponse(401);

    // When
    const result = await invokeHook(request, response);

    // Then
    expect(retry).not.toHaveBeenCalled();
    expect(result).toBe(response);
  });
});
