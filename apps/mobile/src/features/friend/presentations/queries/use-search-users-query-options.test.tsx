import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createMockDIContainer, createMockHttpClient } from '@src/shared/__tests__';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { createSearchUsersDto } from '../../__tests__/friend.factories';
import { FriendService } from '../../services/friend.service';
import { useSearchUsersQueryOptions } from './use-search-users-query-options';

const createWrapper = (httpClient: ReturnType<typeof createMockHttpClient>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = createMockDIContainer({
    friendService: new FriendService(httpClient),
  });

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <StaticDIProvider container={container}>{children}</StaticDIProvider>
    </QueryClientProvider>
  );
};

describe('useSearchUsersQueryOptions', () => {
  test('검색어가 2자 미만이면 쿼리를 실행하지 않는다', () => {
    // Given
    const httpClient = createMockHttpClient();
    const wrapper = createWrapper(httpClient);

    // When
    renderHook(() => useInfiniteQuery(useSearchUsersQueryOptions('a')), { wrapper });

    // Then
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  test('유효한 검색어면 결과를 view-model(displayName/actionState)로 매핑한다', async () => {
    // Given
    const httpClient = createMockHttpClient();
    httpClient.get.mockResolvedValue({ ok: true, value: createSearchUsersDto() });
    const wrapper = createWrapper(httpClient);

    // When
    const { result } = renderHook(() => useInfiniteQuery(useSearchUsersQueryOptions('홍길동')), {
      wrapper,
    });

    // Then
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpClient.get).toHaveBeenCalledWith('v1/follows/search', {
      params: { q: '홍길동', cursor: undefined, limit: undefined },
    });
    const firstItem = result.current.data?.pages[0]?.items[0];
    expect(firstItem?.displayName).toBe('홍길동');
    expect(firstItem?.actionState).toBe('add');
    // 이미 친구인 항목은 actionState=friend
    const friendItem = result.current.data?.pages[0]?.items.find((u) => u.userTag === 'IJKL9012');
    expect(friendItem?.actionState).toBe('friend');
  });
});
