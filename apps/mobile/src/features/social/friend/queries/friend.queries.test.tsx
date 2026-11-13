import { createHttpClientStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useGetUserSearchInfiniteQueryOptions } from './friend.queries';

describe('useGetUserSearchInfiniteQueryOptions', () => {
  it('검색어가 2자 미만이면 쿼리를 실행하지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();

    // When
    await renderScreenHook(
      () => useInfiniteQuery(useGetUserSearchInfiniteQueryOptions({ query: 'a' })),
      { di: createTestDi({ ports: { httpClient } }) },
    );

    // Then
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
