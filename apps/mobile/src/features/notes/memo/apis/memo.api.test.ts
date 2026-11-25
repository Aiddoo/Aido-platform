import { ErrorCode } from '@aido/api/errors';
import { fail } from '@src/core/errors/result';
import { createHttpClientStub, createApiError } from '@src/testing/core';

import { MemoApi } from './memo.api';

describe('MemoApi.parseMemo', () => {
  it('서버 체인 제한 25초보다 오래 기다려 앱이 먼저 끊지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.post.mockResolvedValue(
      fail(createApiError(ErrorCode.SYS_0001, { message: '서버 오류' })),
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
