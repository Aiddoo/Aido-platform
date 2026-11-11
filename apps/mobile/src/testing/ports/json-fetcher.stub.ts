import type { JsonFetcher } from '@src/core/ports/json-fetcher';

import { mockMethod } from '../mock-method';

/** 응답이 필요한 메서드는 테스트가 정한다. 정하지 않고 부르면 이름을 대며 실패한다 */
export function createJsonFetcherStub(): jest.Mocked<JsonFetcher> {
  return {
    get: mockMethod<JsonFetcher['get']>(async () => {
      throw new Error(
        'createJsonFetcherStub: get 응답을 정하지 않았습니다. mockResolvedValue로 정하세요',
      );
    }),
  };
}
