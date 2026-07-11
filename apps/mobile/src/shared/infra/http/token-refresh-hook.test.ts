import type { SessionExpiredDetails } from '@src/core/ports/telemetry-event';
import { createMockTokenStore } from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors';
import { errorReporter } from '@src/shared/infra/error-reporter/global-error-reporter';
import { createTokenRefreshHook, RETRY_MARKER_HEADER } from './token-refresh-hook';
import type { RefreshOutcome } from './token-refresher';

const createFakeRequest = (headers: Record<string, string> = {}): Request => {
  const headerMap = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    url: 'https://api.test/v1/todos',
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
  let tokenStore: ReturnType<typeof createMockTokenStore>;
  let refresh: jest.MockedFunction<() => Promise<RefreshOutcome>>;
  let endSession: jest.MockedFunction<(details: SessionExpiredDetails) => Promise<void>>;
  let captureMessage: jest.SpyInstance;
  let hook: ReturnType<typeof createTokenRefreshHook>;

  beforeEach(() => {
    tokenStore = createMockTokenStore();
    refresh = jest.fn();
    endSession = jest.fn().mockResolvedValue(undefined);
    captureMessage = jest.spyOn(errorReporter, 'captureMessage').mockImplementation(() => {});
    hook = createTokenRefreshHook({ tokenStore, refresh, endSession });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const invokeHook = (request: Request, response: Response) =>
    (hook as (req: Request, opts: unknown, res: Response) => Promise<unknown>)(
      request,
      {},
      response,
    );

  /**
   * 재시도 판정은 ky.retry() 마커 반환으로 표현된다.
   * 응답 객체를 직접 반환하면 expo/fetch의 FetchResponse가 `globalThis.Response`의
   * 인스턴스가 아니라서 ky가 조용히 버리고 원본 401을 살린다 — 마커는 그 함정이 없다.
   */
  const expectForcedRetry = (result: unknown, request: Request) => {
    expect(result).toMatchObject({ options: { delay: 0 } });
    expect(request.headers.get(RETRY_MARKER_HEADER)).toBe('1');
  };

  it('401이 아니면 응답을 그대로 통과시킨다', async () => {
    // Given
    const response = createFakeResponse(200);

    // When
    const result = await invokeHook(createFakeRequest(), response);

    // Then
    expect(result).toBe(response);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('재시도 마커가 있으면 갱신 없이 응답을 반환하고, 즉시 Sentry warning을 남긴다', async () => {
    // Given — 갱신 성공 후 재시도가 다시 401 = 서버가 갓 발급한 토큰을 거부한 것.
    // 서버측 일시 불일치(예: 세션 캐시 스테일) 신호이므로 무음이면 안 된다.
    const response = createFakeResponse(401);
    const request = createFakeRequest({ [RETRY_MARKER_HEADER]: '1' });

    // When
    const result = await invokeHook(request, response);

    // Then — 원 401 반환(화면별 QueryErrorBoundary가 담음) + 즉시 관측
    expect(result).toBe(response);
    expect(refresh).not.toHaveBeenCalled();
    expect(endSession).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledWith(
      'auth_refresh_retry_rejected',
      expect.objectContaining({ severity: 'warning', statusCode: 401 }),
    );
  });

  it('보낸 토큰이 저장된 토큰과 다르면(이미 회전됨) 갱신 없이 강제 재시도를 지시한다', async () => {
    // Given — 불필요한 갱신은 서버의 토큰 패밀리를 소모시킨다
    tokenStore.readAccessToken.mockResolvedValue('fresh-token');
    const request = createFakeRequest({ Authorization: 'Bearer stale-token' });

    // When
    const result = await invokeHook(request, createFakeResponse(401));

    // Then — 재시도 파이프라인의 beforeRequest가 저장소의 새 토큰을 주입한다
    expect(refresh).not.toHaveBeenCalled();
    expectForcedRetry(result, request);
  });

  it('갱신 성공 시 마커를 달아 강제 재시도를 지시한다', async () => {
    // Given
    tokenStore.readAccessToken.mockResolvedValue('current-token');
    refresh.mockResolvedValue({ kind: 'refreshed' });
    const request = createFakeRequest({ Authorization: 'Bearer current-token' });

    // When
    const result = await invokeHook(request, createFakeResponse(401));

    // Then
    expectForcedRetry(result, request);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('서버가 거부하면 서버의 판정(ErrorCode)을 실어 세션을 종료한다', async () => {
    // Given
    tokenStore.readAccessToken.mockResolvedValue('current-token');
    refresh.mockResolvedValue({
      kind: 'invalid',
      details: { reason: 'refresh-rejected', serverErrorCode: 'SESSION_0704' },
    });
    const request = createFakeRequest({ Authorization: 'Bearer current-token' });
    const response = createFakeResponse(401);

    // When
    const result = await invokeHook(request, response);

    // Then
    expect(endSession).toHaveBeenCalledWith({
      reason: 'refresh-rejected',
      serverErrorCode: 'SESSION_0704',
    });
    expect(result).toBe(response);
  });

  it('로컬에 토큰이 없으면 tokens-missing으로 세션을 종료한다', async () => {
    // Given — 이미 로그아웃된 앱의 401. 잡음 여부 판단은 AuthProvider의 몫이다.
    tokenStore.readAccessToken.mockResolvedValue(null);
    refresh.mockResolvedValue({ kind: 'invalid', details: { reason: 'tokens-missing' } });
    const response = createFakeResponse(401);

    // When
    const result = await invokeHook(createFakeRequest(), response);

    // Then
    expect(endSession).toHaveBeenCalledWith({ reason: 'tokens-missing' });
    expect(result).toBe(response);
  });

  it('갱신의 일시 실패(인프라 에러)는 그대로 전파되고 세션은 끝나지 않는다', async () => {
    // Given — 네트워크·5xx·잠긴 키체인. 갱신기가 재시도 가능한 에러를 던지면
    // 훅은 개입하지 않는다 — React Query가 5xx/네트워크와 동일하게 자동 재시도한다.
    tokenStore.readAccessToken.mockResolvedValue('current-token');
    refresh.mockRejectedValue(new NetworkError());
    const request = createFakeRequest({ Authorization: 'Bearer current-token' });
    const response = createFakeResponse(401);

    // When / Then
    await expect(invokeHook(request, response)).rejects.toBeInstanceOf(NetworkError);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('액세스 토큰 읽기가 실패해도 갱신 경로로 넘어간다 (세션 유지)', async () => {
    // Given — 잠긴 키체인. 읽기 실패를 "토큰 없음"으로 오판하면 안 된다.
    tokenStore.readAccessToken.mockRejectedValue(new Error('User interaction is not allowed.'));
    refresh.mockRejectedValue(new NetworkError());
    const response = createFakeResponse(401);

    // When / Then — 갱신 경로로 넘어가고, 일시 실패는 전파되되 세션은 끝나지 않는다
    await expect(invokeHook(createFakeRequest(), response)).rejects.toBeInstanceOf(NetworkError);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(endSession).not.toHaveBeenCalled();
  });
});
