import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { ApiError, NetworkError, ServerError } from '@src/shared/errors';
import {
  createErrorReporterStub,
  createLoggerStub,
  createPendingResponse,
} from '@src/testing/core';
import { waitFor } from '@testing-library/react-native';
import ky, { type KyInstance } from 'ky';

import { createApiFailureBreadcrumbHook } from './api-failure-breadcrumb';
import { createAuthClient } from './auth-client';
import { KyHttpClient } from './ky-client';
import { createTokenRefreshHook, RETRY_MARKER_HEADER } from './token-refresh-hook';
import { createTokenRefresher } from './token-refresher';

/**
 * 인증 파이프라인 통합 테스트.
 *
 * `createAuthClient`와 **동일한 훅 배선**(beforeRequest 토큰 주입 + [recordApiFailureBreadcrumb,
 * createTokenRefreshHook] + retry:0)을 조립하되, env(expo-constants) 결합을 피하려
 * prefixUrl만 테스트용으로 둔다. 네트워크 경계(`global.fetch`)만 fake하고 나머지는 실제 코드다.
 *
 * 검증하려는 핵심 계약(에러 분류는 KyHttpClient 단일 소유):
 * (a) 401 → 갱신 → 재시도 성공 시 값 반환,
 * (b) 재시도도 401이면 로그아웃 없이 `Result.err(ApiError)`로 담김(화면 QueryErrorBoundary가 흡수),
 * (c) 서버가 리프레시 거부 시에만 `endSession` + `ApiError`,
 * (d) 5xx는 재시도 가능한 `ServerError`로 throw(React Query 6회/≈22초 자동 재시도),
 * (e) 갱신의 일시 실패(네트워크·5xx)는 인프라 에러 그대로 전파(로그아웃 없음).
 * ky는 자체 재시도하지 않는다(retry:0).
 */

// ── 서버 응답 빌더 (실제 Response) ──────────────────────────────────────────
const successBody = <T>(data: T) =>
  new Response(JSON.stringify({ success: true, data, timestamp: 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const errorBody = (status: number, code: string, message = 'error') =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// ── 회전을 실제로 반영하는 상태형 토큰 저장소 (모킹 대신 진짜 fake) ──────────
const createStatefulTokenStore = (initial: AuthTokenPair): TokenStore => {
  let tokens: { accessToken: string | null; refreshToken: string | null } = { ...initial };
  return {
    getAccessToken: async () => tokens.accessToken,
    getRefreshToken: async () => tokens.refreshToken,
    save: async (next) => {
      tokens = next;
    },
    clear: async () => {
      tokens = { accessToken: null, refreshToken: null };
    },
  };
};

/** ky는 fetch에 항상 Request를 넘긴다. 다른 입력이면 테스트 전제가 깨진 것이다. */
const toRequest = (input: Parameters<typeof fetch>[0]): Request => {
  if (!(input instanceof Request)) {
    throw new Error('ky가 Request가 아닌 fetch 입력을 넘겼다');
  }
  return input;
};

async function waitForFetchCalls(count: number) {
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(count));
}

describe('createAuthClient: 동시 401', () => {
  const ROTATED = JSON.stringify({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });

  it('동시에 온 401은 갱신을 한 번만 하고 전부 새 토큰으로 재시도한다', async () => {
    // Given
    const authorizations: Array<string | null> = [];
    global.fetch = jest.fn(async (input) => {
      const request = toRequest(input);
      if (request.headers.get(RETRY_MARKER_HEADER) === '1') {
        authorizations.push(request.headers.get('Authorization'));
        return successBody({ url: request.url });
      }
      return errorBody(401, 'AUTH_0102', 'access token expired');
    });
    const tokenStore = createStatefulTokenStore({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    const requestRefresh = jest.fn(
      async () =>
        new Response(ROTATED, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const endSession = jest.fn(async () => undefined);
    const http = new KyHttpClient(
      createAuthClient({
        appVersion: null,
        appBuild: null,
        tokenStore,
        refresh: createTokenRefresher({
          tokenStore,
          requestRefresh,
          sessionEpoch: createSessionEpoch(),
          logger: createLoggerStub(),
        }),
        endSession,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
        errorReporter: createErrorReporterStub(),
      }),
    );

    // When
    const results = await Promise.all([http.get('a'), http.get('b'), http.get('c')]);

    // Then
    expect(results.map((result) => result.ok)).toEqual([true, true, true]);
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(authorizations).toEqual(['Bearer access-2', 'Bearer access-2', 'Bearer access-2']);
    expect(endSession).not.toHaveBeenCalled();
  });
});

describe('createAuthClient: 계정 전환과 늦은 응답', () => {
  const TOKENS_A = { accessToken: 'access-a', refreshToken: 'refresh-a' };
  const TOKENS_B = { accessToken: 'access-b', refreshToken: 'refresh-b' };

  function createPipeline(requestRefresh: RefreshTokensRequest) {
    const sessionEpoch = createSessionEpoch();
    const tokenStore = withSessionEpoch(createStatefulTokenStore(TOKENS_A), sessionEpoch);
    const endSession = jest.fn(async () => undefined);
    const http = new KyHttpClient(
      createAuthClient({
        appVersion: null,
        appBuild: null,
        tokenStore,
        refresh: createTokenRefresher({
          tokenStore,
          requestRefresh,
          sessionEpoch,
          logger: createLoggerStub(),
        }),
        endSession,
        sessionEpoch,
        logger: createLoggerStub(),
        errorReporter: createErrorReporterStub(),
      }),
    );
    return { tokenStore, endSession, http };
  }

  it('A의 늦은 401을 저장된 B 토큰으로 재시도하지 않는다', async () => {
    // Given
    const firstResponse = createPendingResponse(errorBody(401, 'AUTH_0102', 'expired'));
    const sent: Array<string | null> = [];
    global.fetch = jest.fn((input) => {
      sent.push(toRequest(input).headers.get('Authorization'));
      return sent.length === 1 ? firstResponse.response : Promise.resolve(successBody({ id: 1 }));
    });
    const requestRefresh = jest.fn<Promise<Response>, [string]>();
    const { tokenStore, endSession, http } = createPipeline(requestRefresh);
    const requestOfA = http.post('v1/todos', { title: 'A의 할 일' });
    await waitForFetchCalls(1);

    // When
    await tokenStore.clear();
    await tokenStore.save(TOKENS_B);
    firstResponse.settle();
    const result = await requestOfA;

    // Then
    expect(result.ok).toBe(false);
    expect(sent).toEqual(['Bearer access-a']);
    expect(requestRefresh).not.toHaveBeenCalled();
    expect(endSession).not.toHaveBeenCalled();
    await expect(tokenStore.getRefreshToken()).resolves.toBe(TOKENS_B.refreshToken);
  });

  it('A의 늦은 401이 B의 토큰을 지우거나 B 세션을 끝내지 않는다', async () => {
    // Given
    const refreshOfA = createPendingResponse(errorBody(401, 'SESSION_0702', 'revoked'));
    global.fetch = jest.fn(async () => errorBody(401, 'AUTH_0102', 'expired'));
    const { tokenStore, endSession, http } = createPipeline(() => refreshOfA.response);
    const requestOfA = http.get('v1/todos');
    await waitForFetchCalls(1);
    await Promise.resolve();

    // When
    await tokenStore.clear();
    await tokenStore.save(TOKENS_B);
    refreshOfA.settle();
    await requestOfA;

    // Then
    expect(endSession).not.toHaveBeenCalled();
    await expect(tokenStore.getRefreshToken()).resolves.toBe(TOKENS_B.refreshToken);
  });

  it('같은 세션의 늦은 401은 지금처럼 저장된 최신 토큰으로 재시도한다', async () => {
    // Given
    const firstResponse = createPendingResponse(errorBody(401, 'AUTH_0102', 'expired'));
    const sent: Array<string | null> = [];
    global.fetch = jest.fn((input) => {
      const request = toRequest(input);
      sent.push(request.headers.get('Authorization'));
      return request.headers.get(RETRY_MARKER_HEADER) === '1'
        ? Promise.resolve(successBody({ id: 1 }))
        : firstResponse.response;
    });
    const { tokenStore, http } = createPipeline(jest.fn());
    const request = http.get('v1/todos');
    await waitForFetchCalls(1);

    // When
    await tokenStore.save({ accessToken: 'access-a2', refreshToken: 'refresh-a2' });
    firstResponse.settle();
    const result = await request;

    // Then
    expect(result.ok).toBe(true);
    expect(sent).toEqual(['Bearer access-a', 'Bearer access-a2']);
  });
});

describe('인증 클라이언트 통합 (401 → refresh → retry)', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let tokenStore: TokenStore;
  let requestRefresh: jest.MockedFunction<RefreshTokensRequest>;
  let endSession: jest.MockedFunction<(details: unknown) => Promise<void>>;
  let errorReporter: ReturnType<typeof createErrorReporterStub>;
  let http: KyHttpClient;

  const buildClient = (): KyInstance => {
    const sessionEpoch = createSessionEpoch();
    const logger = createLoggerStub();
    errorReporter = createErrorReporterStub();
    const refresh = createTokenRefresher({ tokenStore, requestRefresh, sessionEpoch, logger });

    return ky.create({
      prefix: 'https://api.test',
      // createAuthClient와 동일: 자동 재시도 차단 + 갱신 훅의 강제 재시도(ky.retry) 1회 허용
      retry: { limit: 1, shouldRetry: () => false },
      hooks: {
        beforeRequest: [
          async ({ request }) => {
            const accessToken = await tokenStore.getAccessToken();
            if (accessToken) {
              request.headers.set('Authorization', `Bearer ${accessToken}`);
            }
          },
        ],
        afterResponse: [
          createApiFailureBreadcrumbHook(errorReporter),
          createTokenRefreshHook({
            tokenStore,
            refresh,
            endSession,
            sessionEpoch,
            logger,
            errorReporter,
          }),
        ],
      },
    });
  };

  beforeEach(() => {
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
    global.fetch = fetchMock;
    tokenStore = createStatefulTokenStore({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    requestRefresh = jest.fn();
    endSession = jest.fn().mockResolvedValue(undefined);
    http = new KyHttpClient(buildClient());
  });

  it('갱신에 성공하면 원 요청을 재시도해 데이터를 반환한다', async () => {
    // Given
    // 첫 요청은 401, 갱신 성공(토큰 회전), 마커 붙은 재시도는 200
    let retriedAuthorization: string | null = null;
    fetchMock.mockImplementation(async (input) => {
      const request = toRequest(input);
      if (request.headers.get(RETRY_MARKER_HEADER) === '1') {
        retriedAuthorization = request.headers.get('Authorization');
        return successBody({ id: 'todo-1' });
      }
      return errorBody(401, 'AUTH_0102', 'access token expired');
    });
    requestRefresh.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // When
    const result = await http.get('todos');

    // Then
    // 강제 재시도의 beforeRequest가 회전된 새 토큰을 주입한다
    expect(result).toEqual({ ok: true, value: { id: 'todo-1' } });
    expect(retriedAuthorization).toBe('Bearer access-2');
    // 원 요청 1 + 강제 재시도 1 (자동 재시도 없음)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('갱신 후 재시도가 다시 401이면 세션을 유지한 채 Result.err(ApiError)로 담는다', async () => {
    // Given
    // 회전 레이스: 갱신은 성공하지만 재시도도 401 (매 호출 새 Response — ky가 clone하므로)
    fetchMock.mockImplementation(async () => errorBody(401, 'AUTH_0102', 'access token expired'));
    requestRefresh.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // When
    const result = await http.get('todos');

    // Then
    // 로그아웃(endSession) 없이 ApiError로 담긴다. 세션 종료가 아니므로 화면별
    // QueryErrorBoundary가 로컬 재시도로 흡수한다(앱 레벨로 새지 않음).
    expect(result).toEqual({ ok: false, error: expect.any(ApiError) });
    expect(result).toMatchObject({ error: { status: 401 } });
    // 원 요청 1 + 재시도 1 — ky가 이중 재시도하지 않음
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('서버가 리프레시 토큰을 거부하면 세션을 종료하고 ApiError를 반환한다', async () => {
    // Given
    // 갱신 요청이 401(SESSION_0704: 토큰 재사용 감지)
    fetchMock.mockResolvedValue(errorBody(401, 'AUTH_0105', 're-login required'));
    requestRefresh.mockResolvedValue(errorBody(401, 'SESSION_0704', 'reuse detected'));

    // When
    const result = await http.get('todos');

    // Then
    // 진짜 세션 종료: endSession 호출 + Result.err(ApiError)
    expect(endSession).toHaveBeenCalledWith({
      reason: 'refresh-rejected',
      serverErrorCode: 'SESSION_0704',
    });
    expect(result).toEqual({ ok: false, error: expect.any(ApiError) });
    expect(result).toMatchObject({ error: { status: 401, code: 'AUTH_0105' } });
  });

  it('서버가 5xx를 반환하면 재시도 가능한 ServerError를 던진다', async () => {
    // Given
    // 배포 재시작 부트 구간의 500
    fetchMock.mockResolvedValue(errorBody(500, 'SYS_0001', 'internal error'));

    // When
    const request = http.get('todos');

    // Then
    // 비재시도 ApiError가 아니라 ServerError로 표면화 → React Query가 자동 재시도
    await expect(request).rejects.toBeInstanceOf(ServerError);
    // ky 자체 재시도 없음
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('본문이 JSON이 아닌 프록시 502도 ServerError로 표면화한다', async () => {
    // Given
    // 프록시/게이트웨이가 내려주는 HTML 에러 페이지
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    // When
    const request = http.get('todos');

    // Then
    await expect(request).rejects.toBeInstanceOf(ServerError);
  });

  it('비밀번호가 틀린 업무 401(USER_0602)은 갱신·재전송 없이 ApiError로 담고 Sentry에 남기지 않는다', async () => {
    // Given
    fetchMock.mockImplementation(async () => errorBody(401, 'USER_0602', 'wrong password'));

    // When
    const result = await http.patch('auth/password', { currentPassword: 'wrong' });

    // Then
    expect(result).toMatchObject({ ok: false, error: { code: 'USER_0602', status: 401 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestRefresh).not.toHaveBeenCalled();
    expect(endSession).not.toHaveBeenCalled();
    expect(errorReporter.captureMessage).not.toHaveBeenCalled();
  });

  it('4xx는 서버 코드와 카탈로그 문구를 보존한 Result.err(ApiError)로 담는다', async () => {
    // Given
    fetchMock.mockResolvedValue(errorBody(404, 'TODO_0801', 'todo not found'));

    // When
    const result = await http.get('todos/none');

    // Then
    expect(result).toEqual({ ok: false, error: expect.any(ApiError) });
    expect(result).toMatchObject({
      error: { code: 'TODO_0801', message: '할 일을 찾을 수 없어요' },
    });
  });

  it('갱신 성공 후 재시도가 5xx면 ServerError로 표면화한다', async () => {
    // Given
    // 401 → 갱신 성공 → 재시도 요청이 503 (서버 부팅 중)
    fetchMock.mockImplementation(async (input) => {
      const request = toRequest(input);
      if (request.headers.get(RETRY_MARKER_HEADER) === '1') {
        return errorBody(503, 'SYS_0001', 'booting');
      }
      return errorBody(401, 'AUTH_0102', 'access token expired');
    });
    requestRefresh.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // When
    const request = http.get('todos');

    // Then
    await expect(request).rejects.toBeInstanceOf(ServerError);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('expo/fetch가 연결 실패를 일반 Error로 던져도 NetworkError로 표면화한다', async () => {
    // Given
    fetchMock.mockRejectedValue(
      new Error('fetch failed: java.net.ConnectException: Failed to connect to /10.0.2.2:8090'),
    );

    // When
    const request = http.post('v1/voice-notes/digest', {});

    // Then
    await expect(request).rejects.toBeInstanceOf(NetworkError);
  });

  it('갱신이 일시 실패(서버 재시작·네트워크)하면 로그아웃 없이 NetworkError를 던진다', async () => {
    // Given
    // 콜드 스타트/배포 재시작: 원 요청은 401, 갱신 POST는 네트워크 실패(reject)
    fetchMock.mockResolvedValue(errorBody(401, 'AUTH_0101', 'access token invalid'));
    requestRefresh.mockRejectedValue(new TypeError('Network request failed'));

    // When
    const request = http.get('todos');

    // Then
    // 원 401을 ApiError로 담지 않고, 인프라 에러 그대로 전파한다
    // (React Query가 5xx/네트워크와 동일하게 자동 재시도 → 재시도 화면 대신 로딩 유지).
    await expect(request).rejects.toBeInstanceOf(NetworkError);
    // 세션 유지 — 강제 로그아웃 없음
    expect(endSession).not.toHaveBeenCalled();
    // 원 요청만; 일시 실패는 즉시 던지고 재시도 안 함
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('갱신 엔드포인트가 5xx면 로그아웃 없이 ServerError를 던진다', async () => {
    // Given
    // 갱신 POST가 503 (서버 부팅 중)
    fetchMock.mockResolvedValue(errorBody(401, 'AUTH_0101', 'access token invalid'));
    requestRefresh.mockResolvedValue(errorBody(503, 'SYS_0001', 'booting'));

    // When
    const request = http.get('todos');

    // Then
    await expect(request).rejects.toBeInstanceOf(ServerError);
    expect(endSession).not.toHaveBeenCalled();
  });

  it('일시 실패 뒤 서버가 복귀하면 다음 시도에서 갱신과 재시도로 데이터를 반환한다', async () => {
    // Given
    // 서버 다운: 401 + 갱신 네트워크 실패
    fetchMock.mockResolvedValue(errorBody(401, 'AUTH_0101', 'access token invalid'));
    requestRefresh.mockRejectedValue(new TypeError('Network request failed'));

    // When
    const failedRequest = http.get('todos');

    // Then
    await expect(failedRequest).rejects.toBeInstanceOf(NetworkError);

    // Given
    // 서버 복귀: 갱신 성공(토큰 회전), 마커 붙은 재시도는 200
    fetchMock.mockImplementation(async (input) => {
      const request = toRequest(input);
      if (request.headers.get(RETRY_MARKER_HEADER) === '1') {
        return successBody({ id: 'todo-1' });
      }
      return errorBody(401, 'AUTH_0101', 'access token invalid');
    });
    requestRefresh.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // When
    const result = await http.get('todos');

    // Then
    expect(result).toEqual({ ok: true, value: { id: 'todo-1' } });
    expect(endSession).not.toHaveBeenCalled();
  });
});
