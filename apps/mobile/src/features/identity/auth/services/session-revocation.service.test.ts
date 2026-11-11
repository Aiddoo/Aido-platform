import { ErrorCode } from '@aido/api/errors';
import { subscribeSessionExpired } from '@src/core/events/session-expired';
import { ApiError, err, NetworkError, ok, ServerError } from '@src/shared/errors';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import {
  createErrorReporterStub,
  createMemoryStorage,
  createMemoryTokenStore,
  createHttpClientStub,
} from '@src/testing/core';

import { AuthApi } from '../apis/auth.api';
import { createPendingRevocationRepository } from '../apis/pending-revocation.repository';
import { PENDING_REVOCATION_TTL_MS, SessionRevocationService } from './session-revocation.service';

const NOW = Date.UTC(2026, 10, 7);
const REFRESH_A = 'refresh-a-secret';
const ROTATED = { accessToken: 'access-rotated-secret', refreshToken: 'refresh-rotated-secret' };

function respondWithTokens(): Response {
  return new Response(JSON.stringify({ data: ROTATED }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup() {
  const storage = createMemoryStorage();
  const repository = createPendingRevocationRepository(storage);
  const publicHttpClient = createHttpClientStub();
  publicHttpClient.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
  const requestRefresh = jest.fn<Promise<Response>, [string]>(async () => respondWithTokens());
  const logs: unknown[] = [];
  const record = (...args: unknown[]) => {
    logs.push(args);
  };
  let now = NOW;
  const service = new SessionRevocationService({
    repository,
    requestRefresh,
    authApi: new AuthApi({ publicHttpClient, authHttpClient: createHttpClientStub() }),
    logger: { info: record, warn: record },
    now: () => now,
  });
  return {
    storage,
    repository,
    publicHttpClient,
    requestRefresh,
    logs,
    service,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('SessionRevocationService', () => {
  it('기록은 토큰과 만료 시각을 pendingRevocation 키에 남긴다', async () => {
    // Given
    const { service, storage, repository } = setup();
    const set = jest.spyOn(storage, 'set');

    // When
    await service.record(REFRESH_A);

    // Then
    expect(set).toHaveBeenCalledWith('pendingRevocation', expect.anything());
    await expect(repository.find()).resolves.toEqual({
      refreshToken: REFRESH_A,
      expiresAt: NOW + PENDING_REVOCATION_TTL_MS,
    });
  });

  it('복귀하면 새 access 토큰으로 공개 클라이언트에서 로그아웃하고 기록을 지운다', async () => {
    // Given
    const { service, requestRefresh, publicHttpClient, repository } = setup();
    await service.record(REFRESH_A);

    // When
    await service.flush();

    // Then
    expect(requestRefresh).toHaveBeenCalledWith(REFRESH_A);
    expect(publicHttpClient.post).toHaveBeenCalledWith(
      'v1/auth/logout',
      undefined,
      expect.objectContaining({ headers: { Authorization: `Bearer ${ROTATED.accessToken}` } }),
    );
    await expect(repository.find()).resolves.toBeNull();
  });

  it('처리한 뒤에는 다시 요청하지 않는다', async () => {
    // Given
    const { service, requestRefresh } = setup();
    await service.record(REFRESH_A);
    await service.flush();

    // When
    await service.flush();

    // Then
    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('기록이 없으면 네트워크를 타지 않는다', async () => {
    // Given
    const { service, requestRefresh } = setup();

    // When
    await service.flush();

    // Then
    expect(requestRefresh).not.toHaveBeenCalled();
  });

  it('TTL이 지나면 토큰을 버리고 네트워크를 타지 않는다', async () => {
    // Given
    const { service, requestRefresh, repository, advance } = setup();
    await service.record(REFRESH_A);
    advance(PENDING_REVOCATION_TTL_MS);

    // When
    await service.flush();

    // Then
    expect(requestRefresh).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toBeNull();
  });

  it('TTL 직전까지는 해제한다', async () => {
    // Given
    const { service, requestRefresh, advance } = setup();
    await service.record(REFRESH_A);
    advance(PENDING_REVOCATION_TTL_MS - 1);

    // When
    await service.flush();

    // Then
    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['연결 실패', () => Promise.reject(new TypeError('Network request failed'))],
    ['서버 장애', async () => new Response(null, { status: 503 })],
    ['요청 제한', async () => new Response(null, { status: 429 })],
  ])('갱신이 %s면 기록을 남겨 다음에 다시 시도한다', async (_name, respond) => {
    // Given
    const { service, requestRefresh, repository, publicHttpClient } = setup();
    await service.record(REFRESH_A);
    requestRefresh.mockImplementationOnce(respond);

    // When
    await service.flush();

    // Then
    expect(publicHttpClient.post).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toMatchObject({ refreshToken: REFRESH_A });
  });

  it('갱신이 401이면 세션이 이미 끝난 것이라 기록만 지운다', async () => {
    // Given
    const { service, requestRefresh, repository, publicHttpClient } = setup();
    await service.record(REFRESH_A);
    requestRefresh.mockResolvedValueOnce(new Response(null, { status: 401 }));

    // When
    await service.flush();

    // Then
    expect(publicHttpClient.post).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toBeNull();
  });

  it.each([
    ['연결 실패', new NetworkError()],
    ['서버 장애', new ServerError(503)],
  ])('로그아웃이 %s면 회전한 토큰을 남겨 재사용 감지에 걸리지 않는다', async (_name, failure) => {
    // Given
    const { service, repository, publicHttpClient, requestRefresh } = setup();
    await service.record(REFRESH_A);
    publicHttpClient.post.mockRejectedValueOnce(failure);

    // When
    await service.flush();

    // Then
    await expect(repository.find()).resolves.toEqual({
      refreshToken: ROTATED.refreshToken,
      expiresAt: NOW + PENDING_REVOCATION_TTL_MS,
    });

    // When
    await service.flush();

    // Then
    expect(requestRefresh).toHaveBeenLastCalledWith(ROTATED.refreshToken);
    await expect(repository.find()).resolves.toBeNull();
  });

  it('다시 시도해도 처음 기록한 TTL을 늘리지 않는다', async () => {
    // Given
    const { service, publicHttpClient, repository, advance } = setup();
    await service.record(REFRESH_A);
    publicHttpClient.post.mockRejectedValueOnce(new NetworkError());
    advance(1000);

    // When
    await service.flush();

    // Then
    await expect(repository.find()).resolves.toMatchObject({
      expiresAt: NOW + PENDING_REVOCATION_TTL_MS,
    });
  });

  it('서버가 로그아웃을 거부하면 기록을 지운다', async () => {
    // Given
    const { service, publicHttpClient, repository } = setup();
    await service.record(REFRESH_A);
    publicHttpClient.post.mockResolvedValueOnce(
      err(new ApiError(ErrorCode.SESSION_0702, '이미 폐기됨', 401)),
    );

    // When
    await service.flush();

    // Then
    await expect(repository.find()).resolves.toBeNull();
  });

  it('다른 계정으로 로그인한 뒤의 해제 실패가 그 계정의 토큰과 세션을 건드리지 않는다', async () => {
    // Given
    const { service, requestRefresh } = setup();
    const tokensOfB = { accessToken: 'access-b', refreshToken: 'refresh-b' };
    const tokenStoreOfB = createMemoryTokenStore(tokensOfB);
    const expired = jest.fn();
    const unsubscribe = subscribeSessionExpired(expired);
    await service.record(REFRESH_A);
    requestRefresh.mockResolvedValueOnce(new Response(null, { status: 401 }));

    // When
    await service.flush();
    unsubscribe();

    // Then
    expect(requestRefresh).toHaveBeenCalledWith(REFRESH_A);
    expect(expired).not.toHaveBeenCalled();
    await expect(tokenStoreOfB.getRefreshToken()).resolves.toBe(tokensOfB.refreshToken);
  });

  it('동시에 불러도 요청은 한 번이다', async () => {
    // Given
    const { service, requestRefresh } = setup();
    await service.record(REFRESH_A);

    // When
    await Promise.all([service.flush(), service.flush()]);

    // Then
    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('키체인을 읽지 못해도 던지지 않는다', async () => {
    // Given
    const { service, storage } = setup();
    jest.spyOn(storage, 'get').mockRejectedValueOnce(new Error('User interaction is not allowed.'));

    // When
    const flushing = service.flush();

    // Then
    await expect(flushing).resolves.toBeUndefined();
  });

  it('어떤 실패에도 로그에 토큰 값을 남기지 않는다', async () => {
    // Given
    const { service, publicHttpClient, logs } = setup();
    await service.record(REFRESH_A);
    publicHttpClient.post.mockRejectedValueOnce(new NetworkError());

    // When
    await service.flush();
    publicHttpClient.post.mockResolvedValueOnce(
      err(new ApiError(ErrorCode.SESSION_0702, '이미 폐기됨', 401)),
    );
    await service.flush();

    // Then
    const logged = JSON.stringify(logs);
    expect(logged).not.toContain(REFRESH_A);
    expect(logged).not.toContain(ROTATED.accessToken);
    expect(logged).not.toContain(ROTATED.refreshToken);
  });

  it('실제 공개 클라이언트로 인증 헤더를 싣고, 401에도 갱신을 부르지 않는다', async () => {
    // Given
    const originalFetch = global.fetch;
    const sent: Array<string | null> = [];
    global.fetch = jest.fn(async (input) => {
      if (input instanceof Request) {
        sent.push(input.headers.get('Authorization'));
      }
      return new Response(JSON.stringify({ error: { code: 'SESSION_0702', message: '폐기됨' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { repository, requestRefresh } = setup();
    const service = new SessionRevocationService({
      repository,
      requestRefresh,
      authApi: new AuthApi({
        publicHttpClient: new KyHttpClient(
          createPublicClient({ errorReporter: createErrorReporterStub() }),
        ),
        authHttpClient: createHttpClientStub(),
      }),
      logger: { info: jest.fn(), warn: jest.fn() },
      now: Date.now,
    });
    await service.record(REFRESH_A);

    // When
    await service.flush();
    global.fetch = originalFetch;

    // Then
    expect(sent).toEqual([`Bearer ${ROTATED.accessToken}`]);
    expect(requestRefresh).toHaveBeenCalledTimes(1);
    await expect(repository.find()).resolves.toBeNull();
  });
});
