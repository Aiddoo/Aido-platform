import { ApiError } from '@src/core/errors/api-error';
import { NetworkError, ParseError, ServerError } from '@src/shared/errors/infra-error';
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

  it('JSON이 아닌 응답은 ParseError로 바꿔 던진다', async () => {
    // Given
    const { client } = createClient(
      () => new Response('{invalid', { headers: { 'Content-Type': 'application/json' } }),
    );
    const fetcher = new KyJsonFetcher(client);

    // When
    const result = fetcher.get('v1/app-config/feature-discovery');

    // Then
    await expect(result).rejects.toBeInstanceOf(ParseError);
  });

  it('서버 5xx를 앱의 ServerError로 바꿔 던진다', async () => {
    // Given
    const { client } = createClient(() => new Response('', { status: 503 }));
    const fetcher = new KyJsonFetcher(client);

    // When
    const result = fetcher.get('v1/app-config/app-version');

    // Then
    await expect(result).rejects.toBeInstanceOf(ServerError);
  });

  it('4xx를 앱의 ApiError로 바꿔 던진다', async () => {
    // Given
    const { client } = createClient(() => new Response('', { status: 404 }));
    const fetcher = new KyJsonFetcher(client);

    // When
    const result = fetcher.get('v1/app-config/app-version');

    // Then
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });

  it('연결 실패를 앱의 NetworkError로 바꿔 던진다', async () => {
    // Given
    const client = ky.create({
      baseUrl: 'https://api.test/',
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
      retry: 0,
    });
    const fetcher = new KyJsonFetcher(client);

    // When
    const result = fetcher.get('v1/app-config/app-version');

    // Then
    await expect(result).rejects.toBeInstanceOf(NetworkError);
  });
});
