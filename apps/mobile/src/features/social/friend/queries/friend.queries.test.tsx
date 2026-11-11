import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi, createHttpClientStub, createTestQueryClient } from '@src/testing/core';
import { QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useGetUserSearchInfiniteQueryOptions } from './friend.queries';

const createWrapper = (httpClient: ReturnType<typeof createHttpClientStub>) => {
  const queryClient = createTestQueryClient();
  const container = createTestDi({ httpClient });

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <StaticDIProvider container={container}>{children}</StaticDIProvider>
    </QueryClientProvider>
  );
};

describe('useGetUserSearchInfiniteQueryOptions', () => {
  it('검색어가 2자 미만이면 쿼리를 실행하지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const wrapper = createWrapper(httpClient);

    // When
    await renderHook(() => useInfiniteQuery(useGetUserSearchInfiniteQueryOptions({ query: 'a' })), {
      wrapper,
    });

    // Then
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
