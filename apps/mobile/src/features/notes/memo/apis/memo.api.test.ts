import { ErrorCode, HttpStatus } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import { err } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/testing/core';

import { MemoApi } from './memo.api';

describe('MemoApi.parseMemo', () => {
  it('서버 체인 제한 25초보다 오래 기다려 앱이 먼저 끊지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.post.mockResolvedValue(
      err(new ApiError(ErrorCode.SYS_0001, '서버 오류', HttpStatus.INTERNAL_SERVER_ERROR)),
    );
    const memoApi = new MemoApi(httpClient);

    // When
    await memoApi.parseMemo('메모', 1, 'memo-key');

    // Then
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/ai/parse-memo',
      { content: '메모', categoryId: 1 },
      { headers: { 'Idempotency-Key': 'memo-key' }, timeout: 30_000 },
    );
  });
});
