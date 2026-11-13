import { createTestQueryClient } from '@src/testing/core';
import type { InfiniteData } from '@tanstack/react-query';

import { createMemo } from '../__tests__/memo.fixtures';
import type { MemoPage } from '../domains/memo.model';
import { refreshMemos, replaceMemoInList } from './memo-cache';
import { MEMO_QUERY_KEYS } from './memo-query-keys';

function createMemoList(): InfiniteData<MemoPage, number | undefined> {
  return {
    pages: [
      {
        items: [createMemo({ id: 1, content: '첫 메모' }), createMemo({ id: 2, content: '옛 글' })],
        nextCursor: 2,
      },
      {
        items: [createMemo({ id: 3, content: '다음 쪽 메모' })],
        nextCursor: null,
      },
    ],
    pageParams: [undefined, 2],
  };
}

describe('replaceMemoInList', () => {
  it('해당 메모만 바꾸고 나머지 항목과 쪽은 참조를 유지한다', () => {
    // Given
    const client = createTestQueryClient();
    const before = createMemoList();
    client.setQueryData(MEMO_QUERY_KEYS.list(), before);
    const saved = createMemo({ id: 2, content: '새 글' });

    // When
    replaceMemoInList(client, saved);

    // Then
    const after = client.getQueryData(MEMO_QUERY_KEYS.list());
    expect(after?.pages[0]?.items[1]).toEqual(saved);
    expect(after?.pages[0]?.items[0]).toBe(before.pages[0]?.items[0]);
    expect(after?.pages[1]).toBe(before.pages[1]);
    expect(after?.pageParams).toBe(before.pageParams);
  });

  it('목록에 없는 메모면 목록 참조가 그대로다', () => {
    // Given
    const client = createTestQueryClient();
    const before = createMemoList();
    client.setQueryData(MEMO_QUERY_KEYS.list(), before);

    // When
    replaceMemoInList(client, createMemo({ id: 9 }));

    // Then
    expect(client.getQueryData(MEMO_QUERY_KEYS.list())).toBe(before);
  });

  it('캐시에 목록이 없으면 새로 만들지 않는다', () => {
    // Given
    const client = createTestQueryClient();

    // When
    replaceMemoInList(client, createMemo({ id: 2 }));

    // Then
    expect(client.getQueryState(MEMO_QUERY_KEYS.list())).toBeUndefined();
  });
});

describe('refreshMemos', () => {
  it('목록과 개수 한도만 다시 읽고 열린 메모 상세는 다시 받지 않는다', async () => {
    // Given
    const client = createTestQueryClient();
    client.setQueryData(MEMO_QUERY_KEYS.list(), createMemoList());
    client.setQueryData(MEMO_QUERY_KEYS.resourceLimit(), { currentCount: 3, maxPerUser: 20 });
    client.setQueryData(MEMO_QUERY_KEYS.detail({ memoId: 1 }), createMemo({ id: 1 }));

    // When
    await refreshMemos(client);

    // Then
    expect(client.getQueryState(MEMO_QUERY_KEYS.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(MEMO_QUERY_KEYS.resourceLimit())?.isInvalidated).toBe(true);
    expect(client.getQueryState(MEMO_QUERY_KEYS.detail({ memoId: 1 }))?.isInvalidated).toBe(false);
  });
});
