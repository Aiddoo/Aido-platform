import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { unwrap } from '@src/core/errors/result';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import {
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from '@src/shared/errors/infra-error';
import { i18n } from '@src/shared/i18n';
import { shouldRetryQuery } from '@src/shared/query/query-retry';
import {
  createStalledBodyResponse,
  createTestQueryClient,
  observeSettlement,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import ky from 'ky';

import { KyHttpClient } from './ky-client';
import { API_REQUEST_TIMEOUT_MS } from './request-timeout';

function createClient(respond: () => Promise<Response>) {
  const fetch = jest.fn(respond);
  return new KyHttpClient(
    ky.create({
      baseUrl: 'https://api.test/',
      fetch,
      retry: 0,
      timeout: API_REQUEST_TIMEOUT_MS,
      headers: { 'X-Request-Id': 'req-1' },
    }),
  );
}

function failure(status: number, error: Record<string, unknown>) {
  return async () => Response.json({ success: false, error, timestamp: 0 }, { status });
}

describe('KyHttpClient', () => {
  it('봉투를 지킨 200은 data를 Result.ok로 돌려준다', async () => {
    // Given
    const client = createClient(async () =>
      Response.json({ success: true, data: { id: 1758 }, timestamp: 0 }),
    );

    // When
    const result = await client.get('v1/todos/1758/details');

    // Then
    expect(result).toEqual({ ok: true, value: { id: 1758 } });
  });

  it('봉투와 다른 200 JSON은 ParseError로 던진다', async () => {
    // Given
    const client = createClient(async () => Response.json({ data: { id: 1758 } }));

    // When
    const result = client.get('v1/todos/1758/details');

    // Then
    await expect(result).rejects.toBeInstanceOf(ParseError);
  });

  describe('200 헤더 뒤 본문이 멈추면', () => {
    setupFakeTimersPerTest();

    /** 첫 시도와 재시도 6번이 각각 요청 제한 시간을 다 쓰고, 그 사이 React Query 재시도 대기까지 넘긴다 */
    const QUERY_GIVE_UP_MS = 3 * MINUTE_MS;

    it('요청 제한 시간에 TimeoutError로 끝난다', async () => {
      // Given
      const stalled = createStalledBodyResponse(200);
      const client = createClient(async () => stalled.response);

      // When
      const result = observeSettlement(client.get('v1/todos/1758/details'));
      await jest.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

      // Then
      expect(result.current).toEqual({ status: 'rejected', reason: expect.any(TimeoutError) });
      stalled.finish('{}');
    });

    it('조회는 로딩에 남지 않고 다시 시도한 뒤 오류로 끝나 경계가 다시 시도 화면을 보인다', async () => {
      // Given
      const stalledResponses: Array<ReturnType<typeof createStalledBodyResponse>> = [];
      const client = createClient(async () => {
        const stalled = createStalledBodyResponse(200);
        stalledResponses.push(stalled);
        return stalled.response;
      });
      const queryClient = createTestQueryClient();
      const queryKey = ['todo-detail', 1758];

      // When
      const query = observeSettlement(
        queryClient.fetchQuery({
          queryKey,
          queryFn: async ({ signal }) =>
            unwrap(await client.get('v1/todos/1758/details', { signal })),
          retry: shouldRetryQuery,
        }),
      );
      await jest.advanceTimersByTimeAsync(QUERY_GIVE_UP_MS);

      // Then
      expect(query.current).toEqual({ status: 'rejected', reason: expect.any(TimeoutError) });
      expect(queryClient.getQueryState(queryKey)).toMatchObject({
        status: 'error',
        fetchStatus: 'idle',
      });
      expect(stalledResponses.length).toBeGreaterThan(1);
      for (const stalled of stalledResponses) {
        stalled.finish('{}');
      }
    });
  });

  it('JSON이 아닌 성공 응답은 봉투 검증 실패와 같은 ParseError로 던진다', async () => {
    // Given
    const client = createClient(
      async () =>
        new Response('<html>로그인이 필요해요</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
    );

    // When
    const result = client.get('v1/users/me');

    // Then
    await expect(result).rejects.toBeInstanceOf(ParseError);
  });

  it.each<[string, () => Promise<Response>, { code: string; message: string }]>([
    [
      '알려진 코드는 카탈로그 문구',
      failure(404, { code: ErrorCode.TODO_0801, message: '할일을 찾을 수 없습니다.' }),
      { code: ErrorCode.TODO_0801, message: i18n.t('errors:TODO_0801') },
    ],
    [
      '앱이 모르는 코드는 SYS_0001로 분기하고 서버가 번역한 문구',
      failure(409, { code: 'NEW_9999', message: '서버가 번역한 새 문구' }),
      { code: ErrorCode.SYS_0001, message: '서버가 번역한 새 문구' },
    ],
    [
      '문구도 없는 모르는 코드는 폴백 문구',
      failure(409, { code: 'NEW_9999' }),
      { code: ErrorCode.SYS_0001, message: i18n.t('errors:fallback') },
    ],
    [
      '봉투가 아닌 4xx는 폴백 문구',
      async () => new Response('Not Found', { status: 404 }),
      { code: ErrorCode.SYS_0001, message: i18n.t('errors:fallback') },
    ],
  ])('4xx — %s로 요청 ID를 실은 ApiError를 돌려준다', async (_case, respond, expected) => {
    // Given
    const client = createClient(respond);

    // When
    const result = await client.get('v1/todos/1');

    // Then
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toMatchObject({ ...expected, requestId: 'req-1' });
  });

  it('4xx의 details는 공유 스키마로 읽을 객체로 넘긴다', async () => {
    // Given
    const details = { remainingSeconds: 42 };
    const client = createClient(
      failure(429, { code: ErrorCode.VERIFY_0753, message: '잠시 후', details }),
    );

    // When
    const result = await client.post('v1/auth/verify');

    // Then
    expect(result.ok ? null : result.error).toBeInstanceOf(ApiError);
    expect(result.ok ? null : result.error.details).toEqual(details);
  });

  it.each<[string, () => Promise<Response>, Partial<ServerError>]>([
    [
      'DB 과부하(SYS_0005)는 코드·카탈로그 문구',
      failure(503, { code: ErrorCode.SYS_0005, message: '요청이 많아 처리하지 못했습니다.' }),
      {
        status: 503,
        serverCode: ErrorCode.SYS_0005,
        message: i18n.t('errors:SYS_0005'),
        details: null,
      },
    ],
    [
      'AI 실패(AI_1301)는 미차감 details',
      failure(503, { code: ErrorCode.AI_1301, message: 'AI', details: { charged: false } }),
      { serverCode: ErrorCode.AI_1301, details: { charged: false } },
    ],
    [
      '게이트웨이의 봉투 없는 502는 코드 없이 서버 오류 문구',
      async () => new Response('Bad Gateway', { status: 502 }),
      {
        status: 502,
        serverCode: null,
        details: null,
        message: i18n.t('common:infraErrors.server'),
      },
    ],
    [
      '앱이 모르는 5xx 코드는 코드 없이',
      failure(500, { code: 'NEW_9999', message: '새 장애' }),
      { serverCode: null, message: i18n.t('common:infraErrors.server') },
    ],
  ])('5xx — %s를 실은 ServerError를 던진다', async (_case, respond, expected) => {
    // Given
    const client = createClient(respond);

    // When
    const result = client.post('v1/ai/parse');

    // Then
    await expect(result).rejects.toBeInstanceOf(ServerError);
    await expect(result).rejects.toMatchObject({
      ...expected,
      requestId: 'req-1',
      request: { method: 'POST', endpoint: '/v1/ai/parse' },
    });
  });

  it('연결 실패만 NetworkError로 바꾸고 요청 경로의 TypeError는 그대로 던진다', async () => {
    // Given
    const offline = createClient(async () => {
      throw new TypeError('Network request failed');
    });
    const bug = new TypeError("Cannot read properties of undefined (reading 'id')");
    const broken = createClient(async () => {
      throw bug;
    });

    // When
    const offlineResult = offline.get('v1/todos');
    const brokenResult = broken.get('v1/todos');

    // Then
    await expect(offlineResult).rejects.toBeInstanceOf(NetworkError);
    await expect(brokenResult).rejects.toBe(bug);
  });
});
