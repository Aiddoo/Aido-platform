import { ok } from '@src/core/errors/result';
import { createHttpClientStub, createPendingResponse, renderUiHook } from '@src/shared/__tests__';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';

import { createSentRequestsDto } from '../__tests__/friend.fixtures';
import { useCancelRequestMutationOptions } from './friend.mutations';
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
    expect(result.current.cancel.isPending).toBe(true);
    await act(async () => {
      refetch.settle();
    });
    await waitFor(() => expect(result.current.cancel.isPending).toBe(false));
  });
});
