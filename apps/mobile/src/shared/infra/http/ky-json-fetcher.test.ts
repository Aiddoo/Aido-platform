import ky from 'ky';

import { KyJsonFetcher } from './ky-json-fetcher';

const createClient = (respond: () => Response) => {
  const fetch = jest.fn<Promise<Response>, [Request]>(async () => respond());
  return { fetch, client: ky.create({ baseUrl: 'https://api.test/', fetch, retry: 0 }) };
};

describe('KyJsonFetcher', () => {
  it('data envelope를 해제하지 않고 원문 JSON 객체를 반환한다', async () => {
    // Given
    const rawResponse = { enabled: false };
    const { fetch, client } = createClient(() => Response.json(rawResponse));
    const fetcher = new KyJsonFetcher(client);

    // When
    const result = await fetcher.get('v1/app-config/feature-discovery');

    // Then
    expect(result).toEqual(rawResponse);
    expect(fetch.mock.calls[0]?.[0].url).toBe('https://api.test/v1/app-config/feature-discovery');
  });

  it('JSON 읽기 실패를 호출자에게 전파한다', async () => {
    // Given
    const { client } = createClient(
      () => new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    );
    const fetcher = new KyJsonFetcher(client);

    // When & Then
    await expect(fetcher.get('v1/app-config/feature-discovery')).rejects.toBeInstanceOf(
      SyntaxError,
    );
  });
});
