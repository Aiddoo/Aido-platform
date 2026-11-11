import type { MemoListResponse } from '@aido/api';
import { createTestQueryClient } from '@src/shared/__tests__';

import type { MemoPage } from '../domains/memo.model';
import { toMemoPage } from './memo.mapper';

const MEMO_COUNT = 18;

function createMemoListResponse(): MemoListResponse {
  return {
    items: Array.from({ length: MEMO_COUNT }, (_, index) => ({
      id: index + 1,
      userId: 'clz7x5p8k0001qz0z8z8z8z8z',
      content: `메모 ${index + 1}`,
      isPinned: false,
      sortOrder: index,
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    })),
    pagination: { hasNext: false, nextCursor: null, size: MEMO_COUNT },
  };
}

describe('메모 재조회의 구조 공유', () => {
  it('서버 값이 같으면 재조회해도 메모 항목의 참조가 그대로라 행이 다시 그려지지 않는다', async () => {
    // Given
    const client = createTestQueryClient();
    const queryKey = ['memo', 'list'];
    const fetchPage = async () => {
      await client.query({
        queryKey,
        queryFn: () => toMemoPage(createMemoListResponse()),
        staleTime: 0,
      });
      return client.getQueryData<MemoPage>(queryKey);
    };
    const first = await fetchPage();

    // When
    const second = await fetchPage();

    // Then
    const keptCount =
      second?.items.filter((item, index) => item === first?.items[index]).length ?? 0;
    expect(keptCount).toBe(MEMO_COUNT);
  });
});
