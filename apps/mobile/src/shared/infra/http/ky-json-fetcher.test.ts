import type { KyInstance } from 'ky';

import { KyJsonFetcher } from './ky-json-fetcher';

describe('KyJsonFetcher', () => {
  it('data envelope를 해제하지 않고 원문 JSON 객체를 반환한다', async () => {
    // Given
    const rawResponse = { enabled: false };
    const json = jest.fn().mockResolvedValue(rawResponse);
    const get = jest.fn().mockReturnValue({ json });
    const client = { get } as unknown as Pick<KyInstance, 'get'>;
    const fetcher = new KyJsonFetcher(client);

    // When
    const result = await fetcher.get('v1/app-config/feature-discovery');

    // Then
    expect(result).toBe(rawResponse);
    expect(get).toHaveBeenCalledWith('v1/app-config/feature-discovery');
  });

  it('JSON 읽기 실패를 호출자에게 전파한다', async () => {
    // Given
    const json = jest.fn().mockRejectedValue(new SyntaxError('invalid json'));
    const client = {
      get: jest.fn().mockReturnValue({ json }),
    } as unknown as Pick<KyInstance, 'get'>;
    const fetcher = new KyJsonFetcher(client);

    // When & Then
    await expect(fetcher.get('v1/app-config/feature-discovery')).rejects.toThrow('invalid json');
  });
});
