import { ParseError } from '@src/shared/errors/infra-error';
import ky from 'ky';

import { KyHttpClient } from './ky-client';

describe('KyHttpClient', () => {
  it('JSON이 아닌 성공 응답은 봉투 검증 실패와 같은 ParseError로 던진다', async () => {
    // Given
    const fetch = jest.fn(
      async () =>
        new Response('<html>로그인이 필요해요</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
    );
    const client = new KyHttpClient(ky.create({ baseUrl: 'https://api.test/', fetch, retry: 0 }));

    // When
    const result = client.get('v1/users/me');

    // Then
    await expect(result).rejects.toBeInstanceOf(ParseError);
  });
});
