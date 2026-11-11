import '@src/shared/i18n/init';
import { err, ok } from '@src/core/errors/result';
import {
  createHapticsGatewayStub,
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  renderUiHook,
} from '@src/shared/__tests__';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';

import {
  createFriendApiError,
  createFriendUser,
  createSentRequestsDto,
} from '../__tests__/friend.fixtures';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import {
  useCancelRequestMutationOptions,
  useRemoveFriendMutationOptions,
} from './friend.mutations';
import { useGetSentRequestsInfiniteQueryOptions } from './friend.queries';

describe('보낸 요청 취소', () => {
  it('보낸 요청 목록을 다시 받을 때까지 취소 버튼을 꺼 둔다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    const sentRequests = createSentRequestsDto();
    httpClient.get.mockResolvedValueOnce(ok(sentRequests));
    httpClient.delete.mockResolvedValue(ok({ message: '친구 요청을 철회했습니다.' }));
    const { result } = await renderUiHook(
      () => ({
        sent: useInfiniteQuery(useGetSentRequestsInfiniteQueryOptions()),
        cancel: useMutation(useCancelRequestMutationOptions()),
      }),
      { di: { httpClient } },
    );
    await waitFor(() => expect(result.current.sent.isSuccess).toBe(true));
    const refetch = createPendingResponse(ok({ ...sentRequests, requests: [], totalCount: 0 }));
    httpClient.get.mockReturnValueOnce(refetch.response);

    // When
    await act(async () => {
      result.current.cancel.mutate('user-1');
    });
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(2));

    // Then
    // TanStack Query는 상태 변경을 다음 틱에 알려 주므로 반영을 기다린다
    await waitFor(() => expect(result.current.cancel.isPending).toBe(true));
    await act(async () => {
      refetch.settle();
    });
    await waitFor(() => expect(result.current.cancel.isPending).toBe(false));
  });
});

describe('친구 끊기', () => {
  it('두 명을 함께 끊다 한 명만 실패하면 그 친구만 원래 자리에 돌아오고 다른 친구는 빠진 채 남는다', async () => {
    // Given
    const [first, second, third] = [
      createFriendUser('friend-1'),
      createFriendUser('friend-2'),
      createFriendUser('friend-3'),
    ];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(FRIEND_QUERY_KEYS.friends(), {
      pages: [{ items: [first, second, third], totalCount: 3, hasMore: false }],
      pageParams: [undefined],
    });
    const rejection = createFriendApiError({ code: 'FOLLOW_0904', message: '끊지 못했어요' });
    const firstRemoval = createPendingResponse(err(rejection));
    const secondRemoval = createPendingResponse(ok({ message: '친구를 삭제했습니다.' }));
    const httpClient = createHttpClientStub();
    httpClient.delete
      .mockReturnValueOnce(firstRemoval.response)
      .mockReturnValueOnce(secondRemoval.response);
    const { result } = await renderUiHook(() => useMutation(useRemoveFriendMutationOptions()), {
      queryClient,
      di: { httpClient, haptics: createHapticsGatewayStub() },
    });
    const removals = await act(async () => [
      result.current.mutateAsync(first.id).catch((error: unknown) => error),
      result.current.mutateAsync(second.id),
    ]);

    // When
    await act(async () => {
      firstRemoval.settle();
    });

    // Then
    await expect(removals[0]).resolves.toBe(rejection);
    expect(queryClient.getQueryData(FRIEND_QUERY_KEYS.friends())?.pages[0]).toEqual({
      items: [first, third],
      totalCount: 2,
      hasMore: false,
    });
    expect(queryClient.getQueryState(FRIEND_QUERY_KEYS.friends())?.isInvalidated).toBe(false);
    expect(await screen.findAllByText(rejection.message)).not.toHaveLength(0);
    await act(async () => {
      secondRemoval.settle();
    });
    await removals[1];
    expect(queryClient.getQueryState(FRIEND_QUERY_KEYS.friends())?.isInvalidated).toBe(true);
  });
});
