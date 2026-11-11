import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { NetworkError, ServerError, TimeoutError } from '@src/shared/errors';
import { createLoggerStub, createMemoryTokenStore, createPendingResponse } from '@src/testing/core';
import { TimeoutError as KyTimeoutError } from 'ky';

import { createTokenRefresher } from './token-refresher';

// ok는 status에서 정해진다. 호출부의 ok는 읽는 사람을 위한 표시로 status와 같게 둔다.
const createFakeResponse = (params: { ok: boolean; status: number; body?: unknown }): Response =>
  new Response(params.body == null ? null : JSON.stringify(params.body), {
    status: params.status,
    headers: { 'Content-Type': 'application/json' },
  });

const TOKENS_BODY = {
  success: true,
  data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
  timestamp: 1234567890,
};

const respondWith = (response: Response): jest.MockedFunction<RefreshTokensRequest> =>
  jest.fn<Promise<Response>, [string]>().mockResolvedValue(response);

describe('createTokenRefresher', () => {
  let tokenStore: ReturnType<typeof createMemoryTokenStore>;

  beforeEach(() => {
    tokenStore = createMemoryTokenStore();
  });

  describe('갱신 성공', () => {
    it('새 토큰 쌍을 저장하고 refreshed를 반환한다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = respondWith(
        createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }),
      );

      // When
      const outcome = await createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      expect(outcome).toEqual({ kind: 'refreshed', accessToken: 'new-access' });
      expect(requestRefresh).toHaveBeenCalledWith('old-refresh');
      expect(tokenStore.save).toHaveBeenCalledWith({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });

    it('동시 호출은 하나의 갱신 요청을 공유한다 (single-flight)', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      let resolveResponse: (response: Response) => void = () => {};
      const requestRefresh = jest.fn<Promise<Response>, [string]>().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
      );
      const refresh = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      });

      // When
      const first = refresh();
      const second = refresh();
      resolveResponse(createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }));

      // Then
      await expect(first).resolves.toEqual({ kind: 'refreshed', accessToken: 'new-access' });
      await expect(second).resolves.toEqual({ kind: 'refreshed', accessToken: 'new-access' });
      expect(requestRefresh).toHaveBeenCalledTimes(1);
    });

    it('갱신이 정산된 뒤의 재호출은 새 갱신 요청을 보낸다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = respondWith(
        createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }),
      );
      const refresh = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      });

      // When
      await refresh();
      await refresh();

      // Then
      expect(requestRefresh).toHaveBeenCalledTimes(2);
    });
  });

  describe('세션 무효 판정 (서버 응답에 근거)', () => {
    it('401 응답이면 서버가 준 ErrorCode를 그대로 실어 보고한다', async () => {
      // Given
      // SESSION_0704(토큰 재사용 → 패밀리 폐기)는 단순 만료와 전혀 다른 사건이다
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = respondWith(
        createFakeResponse({
          ok: false,
          status: 401,
          body: { error: { code: 'SESSION_0704', message: '토큰 재사용이 감지되었습니다.' } },
        }),
      );

      // When
      const outcome = await createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      expect(outcome).toEqual({
        kind: 'invalid',
        details: { reason: 'refresh-rejected', serverErrorCode: 'SESSION_0704' },
      });
    });

    it('401 본문을 읽을 수 없으면 서버 코드 없이 refresh-rejected로 보고한다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = respondWith(createFakeResponse({ ok: false, status: 401 }));

      // When
      const outcome = await createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      expect(outcome).toEqual({
        kind: 'invalid',
        details: { reason: 'refresh-rejected', serverErrorCode: undefined },
      });
    });

    it('2xx인데 응답 스키마가 어긋나면 invalid-refresh-response로 보고한다', async () => {
      // Given
      // 서버는 이미 회전했으므로 보유 토큰은 곧 무효
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = respondWith(
        createFakeResponse({ ok: true, status: 200, body: { data: { unexpected: true } } }),
      );

      // When
      const outcome = await createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      expect(outcome).toEqual({
        kind: 'invalid',
        details: { reason: 'invalid-refresh-response' },
      });
    });

    it('리프레시 토큰이 없으면 네트워크 호출 없이 tokens-missing으로 보고한다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue(null);
      const requestRefresh = respondWith(createFakeResponse({ ok: true, status: 200 }));

      // When
      const outcome = await createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      expect(outcome).toEqual({ kind: 'invalid', details: { reason: 'tokens-missing' } });
      expect(requestRefresh).not.toHaveBeenCalled();
    });
  });

  describe('일시적 실패 — 재시도 가능한 인프라 에러로 던진다 (토큰 보존)', () => {
    it.each([429, 500, 503])('%i 응답이면 ServerError를 던진다', async (status) => {
      // Given
      // 서버가 아직 살아나지 못했을 뿐, 보유 토큰은 유효하다
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = respondWith(createFakeResponse({ ok: false, status }));

      // When
      const outcome = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      // React Query가 5xx와 동일하게 자동 재시도한다
      await expect(outcome).rejects.toBeInstanceOf(ServerError);
    });

    it('네트워크 오류면 NetworkError를 던진다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = jest
        .fn<Promise<Response>, [string]>()
        .mockRejectedValue(new TypeError('Network request failed'));

      // When
      const outcome = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      await expect(outcome).rejects.toBeInstanceOf(NetworkError);
    });

    it('갱신 요청 타임아웃이면 TimeoutError를 던진다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      const requestRefresh = jest
        .fn<Promise<Response>, [string]>()
        .mockRejectedValue(new KyTimeoutError(new Request('https://api.test/v1/auth/refresh')));

      // When
      const outcome = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      await expect(outcome).rejects.toBeInstanceOf(TimeoutError);
    });

    it('키체인을 읽을 수 없으면 세션 없음이 아니라 재시도 가능한 에러다', async () => {
      // Given
      // 기기 잠금 중 콜드 스타트: "토큰 없음"으로 오판하면 살아있는 세션이 죽는다
      tokenStore.getRefreshToken.mockRejectedValue(new Error('User interaction is not allowed.'));
      const requestRefresh = respondWith(createFakeResponse({ ok: true, status: 200 }));

      // When
      const outcome = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      await expect(outcome).rejects.toBeInstanceOf(NetworkError);
      expect(requestRefresh).not.toHaveBeenCalled();
    });

    it('새 토큰 저장에 실패하면 재시도 가능한 에러다 (grace 창 안에서 재시도 가능)', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      tokenStore.save.mockRejectedValue(new Error('keychain write failed'));
      const requestRefresh = respondWith(
        createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }),
      );

      // When
      const outcome = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      await expect(outcome).rejects.toBeInstanceOf(NetworkError);
    });

    it('동시 대기자들은 같은 실패를 공유한다 (single-flight)', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');
      let rejectResponse: (error: unknown) => void = () => {};
      const requestRefresh = jest.fn<Promise<Response>, [string]>().mockReturnValue(
        new Promise<Response>((_resolve, reject) => {
          rejectResponse = reject;
        }),
      );
      const refresh = createTokenRefresher({
        tokenStore,
        requestRefresh,
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      });

      // When
      const first = refresh();
      const second = refresh();
      rejectResponse(new TypeError('Network request failed'));

      // Then
      await expect(first).rejects.toBeInstanceOf(NetworkError);
      await expect(second).rejects.toBeInstanceOf(NetworkError);
      expect(requestRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('불변식', () => {
    it.each([
      ['401 거부', createFakeResponse({ ok: false, status: 401 })],
      ['5xx', createFakeResponse({ ok: false, status: 500 })],
      ['스키마 위반', createFakeResponse({ ok: true, status: 200, body: {} })],
      ['갱신 성공', createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY })],
    ])('%s에서도 갱신기는 토큰을 지우지 않는다', async (_case, response) => {
      // Given
      // 세션 종료(토큰 삭제)는 SessionManager의 책임이다
      tokenStore.getRefreshToken.mockResolvedValue('old-refresh');

      // When
      // 일시 실패는 throw되므로 결과와 무관하게 정산만 기다린다
      await createTokenRefresher({
        tokenStore,
        requestRefresh: respondWith(response),
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })().catch(() => {});

      // Then
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('리프레시 토큰이 없을 때도 갱신기는 토큰을 지우지 않는다', async () => {
      // Given
      tokenStore.getRefreshToken.mockResolvedValue(null);

      // When
      await createTokenRefresher({
        tokenStore,
        requestRefresh: respondWith(createFakeResponse({ ok: true, status: 200 })),
        sessionEpoch: createSessionEpoch(),
        logger: createLoggerStub(),
      })();

      // Then
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });
  });

  describe('세션이 끝난 뒤 도착한 응답', () => {
    const TOKENS_A = { accessToken: 'access-a', refreshToken: 'refresh-a' };

    function setup() {
      const sessionEpoch = createSessionEpoch();
      const store = withSessionEpoch(createMemoryTokenStore(TOKENS_A), sessionEpoch);
      const pending = createPendingResponse(
        createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }),
      );
      return { sessionEpoch, store, pending };
    }

    it('로그아웃 뒤 200이 와도 토큰을 되살리지 않고 superseded를 돌려준다', async () => {
      // Given
      const { sessionEpoch, store, pending } = setup();
      const refresh = createTokenRefresher({
        tokenStore: store,
        requestRefresh: () => pending.response,
        sessionEpoch,
        logger: createLoggerStub(),
      });
      const outcome = refresh();
      await Promise.resolve();

      // When
      await store.clear();
      pending.settle();

      // Then
      await expect(outcome).resolves.toEqual({ kind: 'superseded' });
      await expect(store.getRefreshToken()).resolves.toBeNull();
      await expect(store.getAccessToken()).resolves.toBeNull();
    });

    it('로그아웃 뒤 401이 와도 세션 무효로 판정하지 않는다', async () => {
      // Given
      const { sessionEpoch, store } = setup();
      const pending = createPendingResponse(createFakeResponse({ ok: false, status: 401 }));
      const refresh = createTokenRefresher({
        tokenStore: store,
        requestRefresh: () => pending.response,
        sessionEpoch,
        logger: createLoggerStub(),
      });
      const outcome = refresh();
      await Promise.resolve();

      // When
      await store.clear();
      pending.settle();

      // Then
      await expect(outcome).resolves.toEqual({ kind: 'superseded' });
    });

    it('다음 세션의 갱신은 지난 세션의 진행 중 갱신을 공유하지 않는다', async () => {
      // Given
      const { sessionEpoch, store, pending } = setup();
      const nextBody = {
        success: true,
        data: { accessToken: 'access-b', refreshToken: 'refresh-b' },
      };
      const requestRefresh = jest
        .fn<Promise<Response>, [string]>()
        .mockReturnValueOnce(pending.response)
        .mockResolvedValueOnce(createFakeResponse({ ok: true, status: 200, body: nextBody }));
      const refresh = createTokenRefresher({
        tokenStore: store,
        requestRefresh,
        sessionEpoch,
        logger: createLoggerStub(),
      });
      const staleOutcome = refresh();
      await Promise.resolve();
      await store.clear();
      await store.save({ accessToken: 'stale-b', refreshToken: 'refresh-b0' });

      // When
      const nextOutcome = await refresh();
      pending.settle();

      // Then
      expect(nextOutcome).toEqual({ kind: 'refreshed', accessToken: 'access-b' });
      expect(requestRefresh).toHaveBeenLastCalledWith('refresh-b0');
      await expect(staleOutcome).resolves.toEqual({ kind: 'superseded' });
      await expect(store.getRefreshToken()).resolves.toBe('refresh-b');
    });

    it('지난 갱신이 끝나도 다음 세션의 진행 중 갱신을 지우지 않는다', async () => {
      // Given
      const { sessionEpoch, store, pending } = setup();
      const next = createPendingResponse(
        createFakeResponse({ ok: true, status: 200, body: TOKENS_BODY }),
      );
      const requestRefresh = jest
        .fn<Promise<Response>, [string]>()
        .mockReturnValueOnce(pending.response)
        .mockReturnValueOnce(next.response);
      const refresh = createTokenRefresher({
        tokenStore: store,
        requestRefresh,
        sessionEpoch,
        logger: createLoggerStub(),
      });
      const staleOutcome = refresh();
      await Promise.resolve();
      await store.clear();
      await store.save({ accessToken: 'stale-b', refreshToken: 'refresh-b0' });
      const first = refresh();
      await Promise.resolve();
      pending.settle();
      await staleOutcome;

      // When
      const second = refresh();
      next.settle();

      // Then
      await Promise.all([first, second]);
      expect(requestRefresh).toHaveBeenCalledTimes(2);
    });
  });
});
