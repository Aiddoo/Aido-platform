import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi, createHttpClientStub } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { FriendService } from '../apis/friend.service';
import { useGetUserSearchInfiniteQueryOptions } from './friend.queries';

const createWrapper = (httpClient: ReturnType<typeof createHttpClientStub>) => {
  const queryClient = createTestQueryClient();
  const container = createTestDi({
    friendService: new FriendService(httpClient),
  });

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <StaticDIProvider container={container}>{children}</StaticDIProvider>
    </QueryClientProvider>
  );
};

describe('useGetUserSearchInfiniteQueryOptions', () => {
  test('검색어가 2자 미만이면 쿼리를 실행하지 않는다', async () => {
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
