import { z } from 'zod';

import {
  cursorPageSchema,
  getNextCursor,
  mapInfiniteItems,
  selectPageItems,
} from './cursor-page.model';

interface Row {
  id: number;
  isRead: boolean;
}

function createPages(...pages: Row[][]) {
  return {
    pages: pages.map((items, index) => ({
      items,
      nextCursor: index === pages.length - 1 ? null : index + 1,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? undefined : index)),
  };
}

describe('cursorPageSchema', () => {
  it('마지막 쪽은 nextCursor null로 받는다', () => {
    // Given
    const schema = cursorPageSchema(z.object({ id: z.int() }), z.int());

    // When
    const page = schema.parse({ items: [{ id: 1 }], nextCursor: null });

    // Then
    expect(page).toEqual({ items: [{ id: 1 }], nextCursor: null });
  });

  it('nextCursor가 빠진 쪽은 받지 않는다', () => {
    // Given
    const schema = cursorPageSchema(z.object({ id: z.int() }), z.int());

    // When
    const result = schema.safeParse({ items: [] });

    // Then
    expect(result.success).toBe(false);
  });
});

describe('getNextCursor', () => {
  it.each([
    { name: '다음 쪽이 있으면 그 커서', page: { items: [], nextCursor: 7 }, expected: 7 },
    { name: '마지막 쪽이면 undefined', page: { items: [], nextCursor: null }, expected: undefined },
    { name: '커서 0도 다음 쪽이다', page: { items: [], nextCursor: 0 }, expected: 0 },
  ])('$name', ({ page, expected }) => {
    // When
    const cursor = getNextCursor(page);

    // Then
    expect(cursor).toBe(expected);
  });

  it('여러 값으로 이은 커서도 그대로 돌려준다', () => {
    // Given
    const nextCursor = { cursor: 3, throughNudgeId: 9 };

    // When
    const cursor = getNextCursor({ nextCursor });

    // Then
    expect(cursor).toBe(nextCursor);
  });
});

describe('selectPageItems', () => {
  it('받은 쪽의 항목을 순서대로 잇고 빈 쪽은 건너뛴다', () => {
    // Given
    const data = createPages(
      [{ id: 1, isRead: false }],
      [],
      [
        { id: 2, isRead: false },
        { id: 3, isRead: true },
      ],
    );

    // When
    const items = selectPageItems(data);

    // Then
    expect(items.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('받은 쪽이 없으면 빈 목록이다', () => {
    // When
    const items = selectPageItems({ pages: [] });

    // Then
    expect(items).toEqual([]);
  });
});

describe('mapInfiniteItems', () => {
  it('바뀐 항목이 있는 쪽만 새로 만들고 나머지 쪽과 커서는 그대로 둔다', () => {
    // Given
    const data = createPages([{ id: 1, isRead: false }], [{ id: 2, isRead: false }]);

    // When
    const next = mapInfiniteItems(data, (row) => (row.id === 2 ? { ...row, isRead: true } : row));

    // Then
    expect(next).not.toBe(data);
    expect(next.pages[0]).toBe(data.pages[0]);
    expect(next.pages[1]).toEqual({ items: [{ id: 2, isRead: true }], nextCursor: null });
    expect(next.pageParams).toBe(data.pageParams);
  });

  it('바뀐 항목이 없으면 같은 데이터를 돌려준다', () => {
    // Given
    const data = createPages([{ id: 1, isRead: false }], []);

    // When
    const next = mapInfiniteItems(data, (row) => row);

    // Then
    expect(next).toBe(data);
  });
});
