import { createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { useInfiniteQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import { InfiniteListFooter } from './infinite-list';

type Probe = ReturnType<typeof useInfiniteQuery<number, Error, unknown, string[], number>>;

const QUERY_KEY = ['infinite-list-footer'];

async function renderFooter(queryFn: (page: number) => Promise<number>) {
  const probe: { current: Probe | null } = { current: null };
  const queryClient = createTestQueryClient();
  await queryClient.infiniteQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: 1,
  });

  function Harness() {
    const query = useInfiniteQuery({
      queryKey: QUERY_KEY,
      staleTime: Infinity,
      queryFn: ({ pageParam }) => queryFn(pageParam),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage + 1,
    });
    probe.current = query;

    return (
      <InfiniteListFooter
        isFetchingNextPage={query.isFetchingNextPage}
        isFetchNextPageError={query.isFetchNextPageError}
        onRetry={() => {
          query.fetchNextPage().catch(() => undefined);
        }}
      />
    );
  }

  await renderScreen(<Harness />, { queryClient });
  return probe;
}

describe('InfiniteListFooter 컴포넌트', () => {
  it('다음 페이지 요청이 실패하면 다시 시도 버튼을 보인다', async () => {
    // Given
    const queryFn = jest.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('500'));
    const probe = await renderFooter(queryFn);

    // When
    await act(async () => {
      await probe.current?.fetchNextPage();
    });

    // Then
    await waitFor(() => expect(screen.getByRole('button')).toBeTruthy());
  });

  it('실패 뒤 다시 시도하는 동안에는 오류 플래그가 남아도 버튼 대신 로딩을 보인다', async () => {
    // Given
    const queryFn = jest
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('500'))
      .mockReturnValueOnce(new Promise(() => {}));
    const probe = await renderFooter(queryFn);
    await act(async () => {
      await probe.current?.fetchNextPage();
    });
    await waitFor(() => expect(screen.getByRole('button')).toBeTruthy());

    // When
    await act(async () => {
      probe.current?.fetchNextPage().catch(() => undefined);
    });
    await waitFor(() => expect(probe.current?.isFetchingNextPage).toBe(true));

    // Then
    expect(probe.current?.isFetchNextPageError).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
