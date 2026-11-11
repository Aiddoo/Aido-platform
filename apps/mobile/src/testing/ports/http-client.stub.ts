import type { HttpClient } from '@src/core/ports/http-client';

import { mockMethod } from '../mock-method';

function failUnset(method: keyof HttpClient) {
  return async (): Promise<never> => {
    throw new Error(
      `createHttpClientStub: ${method} 응답을 정하지 않았습니다. mockResolvedValue로 정하세요`,
    );
  };
}

/** 응답이 필요한 메서드는 테스트가 정한다. 정하지 않고 부르면 이름을 대며 실패한다 */
export function createHttpClientStub(): jest.Mocked<HttpClient> {
  return {
    get: mockMethod<HttpClient['get']>(failUnset('get')),
    post: mockMethod<HttpClient['post']>(failUnset('post')),
    put: mockMethod<HttpClient['put']>(failUnset('put')),
    patch: mockMethod<HttpClient['patch']>(failUnset('patch')),
    delete: mockMethod<HttpClient['delete']>(failUnset('delete')),
  };
}
