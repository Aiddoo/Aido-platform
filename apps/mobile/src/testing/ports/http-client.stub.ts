import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
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

type PathResponse = Result<unknown, ApiError> | (() => Promise<Result<unknown, ApiError>>);

/**
 * 요청 path마다 응답을 정한다: `httpClient.get.mockImplementation(respondByPath({ 'v1/users/me': ok(me) }))`.
 * Api마다 HTTP stub을 따로 만들어 Service를 손으로 조립하지 않고, 운영처럼 HTTP 하나를 모든 Api가 함께 쓴다.
 * 표에 없는 path는 이름을 대며 실패해 다른 Api가 엉뚱한 응답을 받지 않는다
 */
export function respondByPath(responses: Record<string, PathResponse>) {
  return async (url: string): Promise<Result<unknown, ApiError>> => {
    const response = responses[url];
    if (response == null) {
      throw new Error(`respondByPath: ${url} 응답을 정하지 않았습니다`);
    }
    return typeof response === 'function' ? response() : response;
  };
}
