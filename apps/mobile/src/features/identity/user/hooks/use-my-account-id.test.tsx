import { createHttpClientStub, createTestQueryClient } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';

import { createUser } from '../__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '../queries/user-query-keys';
import { useMyAccountId } from './use-my-account-id';

async function renderAccountId(options: Parameters<typeof useMyAccountId>[0]) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'account-a' }));
  const httpClient = createHttpClientStub();
  const hook = await renderScreenHook(() => useMyAccountId(options), {
    queryClient,
    di: { httpClient },
  });
  return { ...hook, httpClient };
}

describe('useMyAccountId', () => {
  it('내 정보의 id를 돌려준다', async () => {
    // When
    const { result } = await renderAccountId({});

    // Then
    expect(result.current).toBe('account-a');
  });

  it('꺼져 있으면 지난 세션의 캐시가 남아 있어도 null이고 요청하지 않는다', async () => {
    // When
    const { result, httpClient } = await renderAccountId({ isEnabled: false });

    // Then
    expect(result.current).toBeNull();
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
