import { createTestQueryClient } from '@src/shared/__tests__';
import type { InfiniteData } from '@tanstack/react-query';

import { createMemo } from '../__tests__/memo.fixtures';
import { MEMO_QUERY_KEYS } from '../constants/memo-query-keys';
import type { MemoPage } from '../domains/memo.model';
import { replaceMemoInList } from './memo-cache';

function createMemoList(): InfiniteData<MemoPage, number | undefined> {
  return {
    pages: [
      {
        items: [createMemo({ id: 1, content: '첫 메모' }), createMemo({ id: 2, content: '옛 글' })],
        hasNext: true,
        nextCursor: 2,
      },
      {
        items: [createMemo({ id: 3, content: '다음 쪽 메모' })],
        hasNext: false,
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
