import { unwrap } from '@src/core/errors/result';
import { subscribeSessionConfirmed } from '@src/core/events/session-confirmed';
import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { ApiError, NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { shouldRetryQuery } from '@src/shared/query/query-retry';
import {
  createErrorReporterStub,
  createAppLoggerStub,
  createPendingResponse,
  createStalledBodyResponse,
  createTestQueryClient,
  observeSettlement,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { CancelledError, type QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import { delay } from 'es-toolkit';
import ky, { type KyInstance } from 'ky';

import { createApiFailureBreadcrumbHook } from './api-failure-breadcrumb';
import { createAuthClient } from './auth-client';
import { KyHttpClient } from './ky-client';
import { REFRESH_TIMEOUT_MS } from './request-timeout';
import { createTokenRefreshHook, RETRY_MARKER_HEADER } from './token-refresh-hook';
import { createTokenRefresher } from './token-refresher';

/**
 * 인증 파이프라인 통합 테스트.
 *
 * `createAuthClient`와 **동일한 훅 배선**(beforeRequest 토큰 주입 + [recordApiFailureBreadcrumb,
 * createTokenRefreshHook] + retry:0, 오류 분류와 무관한 세션 확인 훅은 뺀다)을 조립하되, env(expo-constants) 결합을 피하려
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
          logger: createAppLoggerStub(),
        }),
        endSession,
        sessionEpoch: createSessionEpoch(),
        logger: createAppLoggerStub(),
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

describe('createAuthClient: 만료된 토큰으로 함께 보낸 두 조회', () => {
  setupFakeTimersPerTest();

  const COMMENTS_PATH = 'v2/todos/1758/comments';
  const DETAILS_PATH = 'v1/todos/1758/details';
  const ROTATED_BODY = JSON.stringify({
    data: { accessToken: 'access-2', refreshToken: 'refresh-2' },
  });
  /** ky가 강제 재시도 전에 쉬는 시간(첫 재시도 0.3초)을 넘긴다 */
  const KY_RETRY_PAUSE_MS = 1_000;
  const RESENT_ONCE_WITH_NEW_TOKEN = [
    `${COMMENTS_PATH} Bearer access-2`,
    `${DETAILS_PATH} Bearer access-2`,
  ];

  const rotatedResponse = () =>
    new Response(ROTATED_BODY, { status: 200, headers: { 'Content-Type': 'application/json' } });

  /**
   * 갱신 뒤 다시 보낸 요청만 바로 200이다. 첫 시도는 `answerFirstAttempt`가 없으면 붙잡아 두고
   * 401을 언제 줄지 테스트가 `answerExpired`로 정한다
   */
  function createPipeline(
    requestRefresh: RefreshTokensRequest,
    answerFirstAttempt?: () => Promise<Response>,
  ) {
    const sessionEpoch = createSessionEpoch();
    const tokenStore = withSessionEpoch(
      createStatefulTokenStore({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      sessionEpoch,
    );
    const endSession = jest.fn(async () => undefined);
    const firstAttempts = new Map<string, PromiseWithResolvers<Response>>();
    const resent: string[] = [];
    global.fetch = jest.fn((input) => {
      const request = toRequest(input);
      const path = new URL(request.url).pathname.slice(1);
      if (request.headers.get(RETRY_MARKER_HEADER) === '1') {
        resent.push(`${path} ${request.headers.get('Authorization')}`);
        return Promise.resolve(successBody({ path }));
      }
      if (answerFirstAttempt != null) {
        return answerFirstAttempt();
      }
      const attempt = Promise.withResolvers<Response>();
      firstAttempts.set(path, attempt);
      return attempt.promise;
    });
    const http = new KyHttpClient(
      createAuthClient({
        appVersion: null,
        appBuild: null,
        tokenStore,
        refresh: createTokenRefresher({
          tokenStore,
          requestRefresh,
          sessionEpoch,
          logger: createAppLoggerStub(),
        }),
        endSession,
        sessionEpoch,
        logger: createAppLoggerStub(),
        errorReporter: createErrorReporterStub(),
      }),
    );
    const answerExpired = (path: string) => {
      firstAttempts.get(path)?.resolve(errorBody(401, 'AUTH_0101', 'access token expired'));
    };
    return { http, tokenStore, endSession, resent, answerExpired };
  }

  function createRefreshGate() {
    const response = Promise.withResolvers<Response>();
    const requestRefresh = jest.fn<Promise<Response>, [string]>(() => response.promise);
    return { requestRefresh, answer: response.resolve };
  }

  const settleMicrotasks = () => jest.advanceTimersByTimeAsync(0);

  it.each<
    [string, (scene: ReturnType<typeof createPipeline>, rotate: () => void) => Promise<void>]
  >([
    [
      '두 401이 갱신 전에 함께 오면',
      async ({ answerExpired }, rotate) => {
        answerExpired(COMMENTS_PATH);
        answerExpired(DETAILS_PATH);
        await settleMicrotasks();
        rotate();
      },
    ],
    [
      '두 번째 401이 갱신 도중에 오면',
      async ({ answerExpired }, rotate) => {
        answerExpired(COMMENTS_PATH);
        await settleMicrotasks();
        answerExpired(DETAILS_PATH);
        await settleMicrotasks();
        rotate();
      },
    ],
    [
      '두 번째 401이 갱신이 끝난 뒤에 오면',
      async ({ answerExpired }, rotate) => {
        answerExpired(COMMENTS_PATH);
        await settleMicrotasks();
        rotate();
        await jest.advanceTimersByTimeAsync(KY_RETRY_PAUSE_MS);
        answerExpired(DETAILS_PATH);
      },
    ],
  ])('%s 갱신 한 번 뒤 두 요청을 새 토큰으로 한 번씩 다시 보내 받는다', async (_name, arrive) => {
    // Given
    const refresh = createRefreshGate();
    const scene = createPipeline(refresh.requestRefresh);
    const comments = observeSettlement(scene.http.get(COMMENTS_PATH));
    const details = observeSettlement(scene.http.get(DETAILS_PATH));
    await settleMicrotasks();

    // When
    await arrive(scene, () => refresh.answer(rotatedResponse()));
    await jest.advanceTimersByTimeAsync(KY_RETRY_PAUSE_MS);

    // Then
    expect(comments.current).toEqual({
      status: 'fulfilled',
      value: { ok: true, value: { path: COMMENTS_PATH } },
    });
    expect(details.current).toEqual({
      status: 'fulfilled',
      value: { ok: true, value: { path: DETAILS_PATH } },
    });
    expect(scene.resent).toHaveLength(RESENT_ONCE_WITH_NEW_TOKEN.length);
    expect(scene.resent).toEqual(expect.arrayContaining(RESENT_ONCE_WITH_NEW_TOKEN));
    expect(refresh.requestRefresh).toHaveBeenCalledTimes(1);
    expect(scene.endSession).not.toHaveBeenCalled();
  });

  it('갱신 도중 취소한 조회를 다시 불러도 갱신은 한 번이고 다시 부른 조회와 다른 조회가 새 토큰으로 받는다', async () => {
    // Given
    const refresh = createRefreshGate();
    const scene = createPipeline(refresh.requestRefresh);
    const cancelled = new AbortController();
    const comments = observeSettlement(scene.http.get(COMMENTS_PATH, { signal: cancelled.signal }));
    const details = observeSettlement(scene.http.get(DETAILS_PATH));
    await settleMicrotasks();
    scene.answerExpired(COMMENTS_PATH);
    scene.answerExpired(DETAILS_PATH);
    await settleMicrotasks();

    // When
    cancelled.abort();
    const refetched = observeSettlement(
      scene.http.get(COMMENTS_PATH, { signal: new AbortController().signal }),
    );
    await settleMicrotasks();
    scene.answerExpired(COMMENTS_PATH);
    await settleMicrotasks();
    refresh.answer(rotatedResponse());
    await jest.advanceTimersByTimeAsync(KY_RETRY_PAUSE_MS);

    // Then
    expect(comments.current).toEqual({
      status: 'rejected',
      reason: expect.objectContaining({ name: 'AbortError' }),
    });
    expect(refetched.current).toEqual({
      status: 'fulfilled',
      value: { ok: true, value: { path: COMMENTS_PATH } },
    });
    expect(details.current).toEqual({
      status: 'fulfilled',
      value: { ok: true, value: { path: DETAILS_PATH } },
    });
    expect(scene.resent).toHaveLength(RESENT_ONCE_WITH_NEW_TOKEN.length);
    expect(scene.resent).toEqual(expect.arrayContaining(RESENT_ONCE_WITH_NEW_TOKEN));
    expect(refresh.requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('갱신이 거부되면 두 요청 모두 다시 보내지 않고 401 ApiError로 끝나 세션을 끝낸다', async () => {
    // Given
    const refresh = createRefreshGate();
    const scene = createPipeline(refresh.requestRefresh);
    const comments = observeSettlement(scene.http.get(COMMENTS_PATH));
    const details = observeSettlement(scene.http.get(DETAILS_PATH));
    await settleMicrotasks();

    // When
    scene.answerExpired(COMMENTS_PATH);
    scene.answerExpired(DETAILS_PATH);
    await settleMicrotasks();
    refresh.answer(errorBody(401, 'SESSION_0702', 'session expired'));
    await jest.advanceTimersByTimeAsync(KY_RETRY_PAUSE_MS);

    // Then
    const unauthorized = {
      status: 'fulfilled',
      value: { ok: false, error: expect.objectContaining({ status: 401, code: 'AUTH_0101' }) },
    };
    expect(comments.current).toEqual(unauthorized);
    expect(details.current).toEqual(unauthorized);
    expect(scene.resent).toEqual([]);
    expect(refresh.requestRefresh).toHaveBeenCalledTimes(1);
    expect(scene.endSession).toHaveBeenCalledWith({
      reason: 'refresh-rejected',
      serverErrorCode: 'SESSION_0702',
    });
  });

  it('갱신이 200 헤더 뒤 본문을 끝내지 않아도 두 요청은 멈추지 않고 TimeoutError로 끝나 세션을 유지한다', async () => {
    // Given
    const stalled = createStalledBodyResponse(200);
    const requestRefresh = jest.fn<Promise<Response>, [string]>(async () => stalled.response);
    const scene = createPipeline(requestRefresh);
    const comments = observeSettlement(scene.http.get(COMMENTS_PATH));
    const details = observeSettlement(scene.http.get(DETAILS_PATH));
    await settleMicrotasks();

    // When
    scene.answerExpired(COMMENTS_PATH);
    scene.answerExpired(DETAILS_PATH);
    await jest.advanceTimersByTimeAsync(REFRESH_TIMEOUT_MS);

    // Then
    expect(comments.current).toEqual({ status: 'rejected', reason: expect.any(TimeoutError) });
    expect(details.current).toEqual({ status: 'rejected', reason: expect.any(TimeoutError) });
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(scene.resent).toEqual([]);
    expect(scene.endSession).not.toHaveBeenCalled();
    await expect(scene.tokenStore.getRefreshToken()).resolves.toBe('refresh-1');
    stalled.finish(ROTATED_BODY);
  });

  describe('React Query 조회로 부르면', () => {
    /** 갱신 제한 시간, React Query 재시도 대기(1·2·4초), ky 재시도 쉼을 모두 넘긴다 */
    const QUERY_RECOVERY_WINDOW_MS = 30 * SECOND_MS;

    /** 실제 갱신처럼 왕복 시간을 둔다. 같은 순간 다시 시도한 두 조회가 한 갱신을 함께 기다린다 */
    const REFRESH_ROUND_TRIP_MS = 50;

    const answerExpiredNow = async () => errorBody(401, 'AUTH_0101', 'access token expired');
    const rotateAfterRoundTrip = async () => {
      await delay(REFRESH_ROUND_TRIP_MS);
      return rotatedResponse();
    };
    const todoDetailKey = (path: string) => ['todo-detail', path];

    function fetchTodoDetail(queryClient: QueryClient, http: KyHttpClient, path: string) {
      return queryClient.fetchQuery({
        queryKey: todoDetailKey(path),
        queryFn: async ({ signal }) => unwrap(await http.get(path, { signal })),
        retry: shouldRetryQuery,
      });
    }

    function createRefreshAfterStall() {
      const stalled = createStalledBodyResponse(200);
      const requestRefresh = jest
        .fn<Promise<Response>, [string]>()
        .mockResolvedValueOnce(stalled.response)
        .mockImplementation(rotateAfterRoundTrip);
      return { requestRefresh, finishStalled: () => stalled.finish(ROTATED_BODY) };
    }

    it('갱신 본문이 멈춰도 두 조회는 로딩에 남지 않고 다시 시도해 새 토큰으로 받는다', async () => {
      // Given
      const refresh = createRefreshAfterStall();
      const scene = createPipeline(refresh.requestRefresh, answerExpiredNow);
      const queryClient = createTestQueryClient();

      // When
      const comments = observeSettlement(fetchTodoDetail(queryClient, scene.http, COMMENTS_PATH));
      const details = observeSettlement(fetchTodoDetail(queryClient, scene.http, DETAILS_PATH));
      await jest.advanceTimersByTimeAsync(QUERY_RECOVERY_WINDOW_MS);

      // Then
      expect(comments.current).toEqual({ status: 'fulfilled', value: { path: COMMENTS_PATH } });
      expect(details.current).toEqual({ status: 'fulfilled', value: { path: DETAILS_PATH } });
      expect(scene.resent).toHaveLength(RESENT_ONCE_WITH_NEW_TOKEN.length);
      expect(scene.resent).toEqual(expect.arrayContaining(RESENT_ONCE_WITH_NEW_TOKEN));
      expect(refresh.requestRefresh).toHaveBeenCalledTimes(2);
      expect(scene.endSession).not.toHaveBeenCalled();
      refresh.finishStalled();
    });

    it.each<[string, () => ReturnType<typeof createRefreshAfterStall>, number]>([
      [
        '갱신이 바로 끝나면',
        () => ({
          requestRefresh: jest.fn<Promise<Response>, [string]>(rotateAfterRoundTrip),
          finishStalled: () => undefined,
        }),
        1,
      ],
      ['첫 갱신 본문이 멈추면', createRefreshAfterStall, 2],
    ])(
      '연결을 거부하던 프록시가 돌아온 뒤 %s 두 조회가 다시 시도해 받는다',
      async (_name, createRefresh, refreshCount) => {
        // Given
        let isRefusingConnections = true;
        const refresh = createRefresh();
        const scene = createPipeline(refresh.requestRefresh, async () => {
          if (isRefusingConnections) {
            throw new TypeError('Network request failed');
          }
          return answerExpiredNow();
        });
        const queryClient = createTestQueryClient();
        const comments = observeSettlement(fetchTodoDetail(queryClient, scene.http, COMMENTS_PATH));
        const details = observeSettlement(fetchTodoDetail(queryClient, scene.http, DETAILS_PATH));
        await jest.advanceTimersByTimeAsync(2 * SECOND_MS);

        // When
        isRefusingConnections = false;
        await jest.advanceTimersByTimeAsync(QUERY_RECOVERY_WINDOW_MS);

        // Then
        expect(comments.current).toEqual({ status: 'fulfilled', value: { path: COMMENTS_PATH } });
        expect(details.current).toEqual({ status: 'fulfilled', value: { path: DETAILS_PATH } });
        expect(scene.resent).toHaveLength(RESENT_ONCE_WITH_NEW_TOKEN.length);
        expect(refresh.requestRefresh).toHaveBeenCalledTimes(refreshCount);
        expect(scene.endSession).not.toHaveBeenCalled();
        refresh.finishStalled();
      },
    );

    it('갱신 도중 한 조회를 취소하고 다시 부르거나 다른 조회를 다시 불러도 갱신은 한 번이고 두 조회가 새 토큰으로 받는다', async () => {
      // Given
      const refresh = createRefreshGate();
      const scene = createPipeline(refresh.requestRefresh, answerExpiredNow);
      const queryClient = createTestQueryClient();
      const cancelled = observeSettlement(fetchTodoDetail(queryClient, scene.http, COMMENTS_PATH));
      const details = observeSettlement(fetchTodoDetail(queryClient, scene.http, DETAILS_PATH));
      await settleMicrotasks();

      // When
      await queryClient.cancelQueries({ queryKey: todoDetailKey(COMMENTS_PATH) });
      const refetched = observeSettlement(fetchTodoDetail(queryClient, scene.http, COMMENTS_PATH));
      const detailsRefetch = observeSettlement(
        queryClient.refetchQueries({ queryKey: todoDetailKey(DETAILS_PATH) }),
      );
      await settleMicrotasks();
      refresh.answer(rotatedResponse());
      await jest.advanceTimersByTimeAsync(KY_RETRY_PAUSE_MS);

      // Then
      expect(cancelled.current).toEqual({
        status: 'rejected',
        reason: expect.any(CancelledError),
      });
      expect(refetched.current).toEqual({ status: 'fulfilled', value: { path: COMMENTS_PATH } });
      expect(details.current).toEqual({ status: 'fulfilled', value: { path: DETAILS_PATH } });
      expect(detailsRefetch.current.status).toBe('fulfilled');
      expect(scene.resent).toHaveLength(RESENT_ONCE_WITH_NEW_TOKEN.length);
      expect(scene.resent).toEqual(expect.arrayContaining(RESENT_ONCE_WITH_NEW_TOKEN));
      expect(refresh.requestRefresh).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createAuthClient: 세션 확인', () => {
  it.each([
    ['성공하면', () => successBody({}), 1],
    ['서버 장애면', () => errorBody(503, 'SYS_0001'), 0],
    ['업무 오류면', () => errorBody(400, 'USER_0602'), 0],
  ])('인증 요청이 %s 세션 확인을 %s번 알린다', async (_name, respond, times) => {
    // Given
    global.fetch = jest.fn(async () => respond());
    const tokenStore = createStatefulTokenStore({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    const sessionEpoch = createSessionEpoch();
    const http = new KyHttpClient(
      createAuthClient({
        appVersion: null,
        appBuild: null,
        tokenStore,
        refresh: createTokenRefresher({
          tokenStore,
          requestRefresh: jest.fn(),
          sessionEpoch,
          logger: createAppLoggerStub(),
        }),
        endSession: jest.fn(async () => undefined),
        sessionEpoch,
        logger: createAppLoggerStub(),
        errorReporter: createErrorReporterStub(),
      }),
    );
    const confirmed = jest.fn();
    const unsubscribe = subscribeSessionConfirmed(confirmed);

    // When
    await http.get('v1/todos').catch(() => undefined);
    unsubscribe();

    // Then
    expect(confirmed).toHaveBeenCalledTimes(times);
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
          logger: createAppLoggerStub(),
        }),
        endSession,
        sessionEpoch,
        logger: createAppLoggerStub(),
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
    const logger = createAppLoggerStub();
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
