import { createMockHttpClient } from '@src/shared/__tests__';
import { ApiError } from '@src/shared/errors/api-error';
import { err } from '@src/shared/errors/result';

import { AiService } from './ai.service';

const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

describe('AiService.parseMemo', () => {
  test('서버 체인 제한 25초보다 오래 기다려 앱이 먼저 끊지 않는다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.post.mockResolvedValue(err(new ApiError('INTERNAL', '서버 오류', 500)));
    const service = new AiService(httpClient, logger);

    // When
    await service.parseMemo('메모', 1, 'memo-key');

    // Then
    expect(httpClient.post).toHaveBeenCalledWith(
      'v1/ai/parse-memo',
      { content: '메모', categoryId: 1 },
      { headers: { 'Idempotency-Key': 'memo-key' }, timeout: 30_000 },
    );
  });
});
