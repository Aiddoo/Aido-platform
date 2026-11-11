import { ApiError } from '@src/core/errors/api-error';
import { err, ok } from '@src/core/errors/result';
import { ParseError } from '@src/shared/errors/infra-error';
import { createHttpClientStub, createLoggerStub } from '@src/testing/core';

import { MemoApi } from './memo.api';

describe('MemoApi.parseMemo', () => {
  it('서버 체인 제한 25초보다 오래 기다려 앱이 먼저 끊지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.post.mockResolvedValue(err(new ApiError('INTERNAL', '서버 오류', 500)));
    const service = new MemoApi(httpClient, createLoggerStub());

    // When
    await service.parseMemo('메모', 1, 'memo-key');

    // Then
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/ai/parse-memo',
      { content: '메모', categoryId: 1 },
      { headers: { 'Idempotency-Key': 'memo-key' }, timeout: 30_000 },
    );
  });

  it('응답이 계약과 다르면 파싱 실패를 기록하고 던진다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.post.mockResolvedValue(ok({ unexpected: true }));
    const error = jest.fn();
    const service = new MemoApi(httpClient, { ...createLoggerStub(), error });

    // When
    const parsing = service.parseMemo('메모', 1, 'memo-key');

    // Then
    await expect(parsing).rejects.toBeInstanceOf(ParseError);
    expect(error).toHaveBeenCalledWith('memo.response-parse.failed', undefined, {
      method: 'parseMemo',
      zodError: expect.any(String),
    });
  });
});
