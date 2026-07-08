import type { SessionExpiredDetails } from '@src/core/ports/telemetry-event';
import { createMockTokenStore } from '@src/shared/__tests__';
import { createTokenRefreshHook, RETRY_MARKER_HEADER } from './token-refresh-hook';
import type { RefreshOutcome } from './token-refresher';

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
  let tokenStore: ReturnType<typeof createMockTokenStore>;
  let refresh: jest.MockedFunction<() => Promise<RefreshOutcome>>;
  let endSession: jest.MockedFunction<(details: SessionExpiredDetails) => Promise<void>>;
  let retry: jest.MockedFunction<(request: Request) => Promise<Response>>;
  let hook: ReturnType<typeof createTokenRefreshHook>;

  beforeEach(() => {
    tokenStore = createMockTokenStore();
    refresh = jest.fn();
    endSession = jest.fn().mockResolvedValue(undefined);
    retry = jest.fn();
    hook = createTokenRefreshHook({ tokenStore, refresh, endSession, retry });
  });

  const invokeHook = (request: Request, response: Response) =>
    (hook as (req: Request, opts: unknown, res: Response) => Promise<Response>)(
      request,
      {},
      response,
    );

  it('401이 아니면 응답을 그대로 통과시킨다', async () => {
    // Given
    const response = createFakeResponse(200);

    // When
    const result = await invokeHook(createFakeRequest(), response);

    // Then
    expect(result).toBe(response);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('재시도 마커가 있으면 갱신 없이 응답을 반환한다 (루프 가드)', async () => {
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

  it('보낸 토큰이 저장된 토큰과 다르면(이미 회전됨) 갱신 없이 재시도한다', async () => {
    // Given — 불필요한 갱신은 서버의 토큰 패밀리를 소모시킨다
    tokenStore.readAccessToken.mockResolvedValue('fresh-token');
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

  it('갱신 성공 시 마커를 달아 재시도한다', async () => {
    // Given
    tokenStore.readAccessToken.mockResolvedValue('current-token');
    refresh.mockResolvedValue({ kind: 'refreshed' });
    const request = createFakeRequest({ Authorization: 'Bearer current-token' });
    const retried = createFakeResponse(200);
    retry.mockResolvedValue(retried);

    // When
    const result = await invokeHook(request, createFakeResponse(401));

    // Then
    expect(request.headers.get(RETRY_MARKER_HEADER)).toBe('1');
    expect(result).toBe(retried);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('서버가 거부하면 서버의 판정(ErrorCode)을 실어 세션을 종료한다', async () => {
    // Given
    tokenStore.readAccessToken.mockResolvedValue('current-token');
    refresh.mockResolvedValue({
      kind: 'session-invalid',
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
    expect(retry).not.toHaveBeenCalled();
    expect(result).toBe(response);
  });

  it('로컬에 토큰이 없으면 tokens-missing으로 세션을 종료한다', async () => {
    // Given — 이미 로그아웃된 앱의 401. 잡음 여부 판단은 AuthProvider의 몫이다.
    tokenStore.readAccessToken.mockResolvedValue(null);
    refresh.mockResolvedValue({ kind: 'no-session' });
    const response = createFakeResponse(401);

    // When
    const result = await invokeHook(createFakeRequest(), response);

    // Then
    expect(endSession).toHaveBeenCalledWith({ reason: 'tokens-missing' });
    expect(result).toBe(response);
  });

  it('일시적 갱신 실패에서는 세션을 끝내지 않는다', async () => {
    // Given — 네트워크·5xx·잠긴 키체인. 서버 장애가 로그아웃이 되면 안 된다.
    tokenStore.readAccessToken.mockResolvedValue('current-token');
    refresh.mockResolvedValue({ kind: 'transient-failure' });
    const request = createFakeRequest({ Authorization: 'Bearer current-token' });
    const response = createFakeResponse(401);

    // When
    const result = await invokeHook(request, response);

    // Then
    expect(endSession).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(result).toBe(response);
  });

  it('액세스 토큰 읽기가 실패해도 갱신 경로로 넘어간다 (세션 유지)', async () => {
    // Given — 잠긴 키체인. 읽기 실패를 "토큰 없음"으로 오판하면 안 된다.
    tokenStore.readAccessToken.mockRejectedValue(new Error('User interaction is not allowed.'));
    refresh.mockResolvedValue({ kind: 'transient-failure' });
    const response = createFakeResponse(401);

    // When
    const result = await invokeHook(createFakeRequest(), response);

    // Then
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(endSession).not.toHaveBeenCalled();
    expect(result).toBe(response);
  });
});
