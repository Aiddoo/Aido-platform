import { ErrorCode } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { NetworkError, ParseError, ServerError } from '@src/shared/errors/infra-error';
import { i18n } from '@src/shared/i18n';
import ky from 'ky';

import { KyHttpClient } from './ky-client';

function createClient(respond: () => Promise<Response>) {
  const fetch = jest.fn(respond);
  return new KyHttpClient(
    ky.create({
      baseUrl: 'https://api.test/',
      fetch,
      retry: 0,
      headers: { 'X-Request-Id': 'req-1' },
    }),
  );
}

function failure(status: number, error: Record<string, unknown>) {
  return async () => Response.json({ success: false, error, timestamp: 0 }, { status });
}

describe('KyHttpClient', () => {
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
