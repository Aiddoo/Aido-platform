import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { toInstant } from '@src/shared/date/instant';
import { createMemorySyncStorage, createTestQueryClient } from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { act, render } from '@testing-library/react-native';
import { memo, Suspense } from 'react';
import { Text } from 'react-native';
import { z } from 'zod';

import {
  createQueryCacheStorage,
  createQueryPersistOptions,
} from '../query/query-cache-persistence';

interface MemoItem {
  id: string;
  createdAt: ReturnType<typeof toInstant>;
}

const QUERY_KEY = ['memos'] as const;
const MEMO_COUNT = 18;
const TEST_SCHEMAS = [{ queryKey: QUERY_KEY, schema: z.unknown() }];

function createMemos(): MemoItem[] {
  return Array.from({ length: MEMO_COUNT }, (_, index) => ({
    id: `memo-${index}`,
    createdAt: toInstant(`2026-11-0${(index % 9) + 1}T00:00:00.000Z`),
  }));
}

describe('복원한 캐시를 다시 조회할 때의 구조 공유', () => {
  setupFakeTimersPerTest();

  it('같은 값의 메모 18개를 다시 조회해도 항목을 다시 그리지 않는다', async () => {
    // 저장했다가 복원한 캐시
    // Given
    const storage = createQueryCacheStorage(createMemorySyncStorage());
    storage.setOwner('user-1');
    const options = createQueryPersistOptions({
      storage,
      buster: '5:1.15.0:ko',
      schemas: TEST_SCHEMAS,
    });
    const source = createTestQueryClient();
    source.getQueryCache().build(source, { queryKey: QUERY_KEY, ...PERSISTED_QUERY_OPTIONS });
    source.setQueryData(QUERY_KEY, createMemos());
    await persistQueryClientSave({ queryClient: source, ...options });
    await jest.runAllTimersAsync();
    const queryClient = createTestQueryClient();
    await persistQueryClientRestore({ queryClient, ...options });

    const renderCounts = new Map<string, number>();
    const Item = memo(function Item({ item }: { item: MemoItem }) {
      renderCounts.set(item.id, (renderCounts.get(item.id) ?? 0) + 1);
      return <Text>{item.id}</Text>;
    });
    function List() {
      const { data } = useSuspenseQuery({
        queryKey: QUERY_KEY,
        queryFn: async () => createMemos(),
      });
      return data.map((item) => <Item key={item.id} item={item} />);
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <List />
        </Suspense>
      </QueryClientProvider>,
    );
    const restored = queryClient.getQueryData<MemoItem[]>(QUERY_KEY) ?? [];

    // 서버가 같은 값을 새 객체로 돌려준다
    // When
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: QUERY_KEY });
    });

    // Then
    const refetched = queryClient.getQueryData<MemoItem[]>(QUERY_KEY) ?? [];
    expect(refetched).toHaveLength(MEMO_COUNT);
    expect(refetched.filter((item, index) => item === restored[index])).toHaveLength(MEMO_COUNT);
    expect([...renderCounts.values()].every((count) => count === 1)).toBe(true);
  });
});
